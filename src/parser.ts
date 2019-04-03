import {
  IGQLField,
  Parser as prismaParser,
  DatabaseType,
  IGQLType,
} from 'prisma-datamodel'
import Sequelize, {DefineAttributeColumnOptions, Utils} from 'sequelize'
import {ITableRelation, ItableDefinition, IParserConfig} from './interfaces'
import Adapters from './adapters'
import debug from 'debug'
import {appLog} from '.'
import {
  generateConnectingTable,
  generateTableName,
  lowercaseFirstLetter,
} from './util/utils'

export default class DefaultParser {
  private config: IParserConfig
  private tables: ItableDefinition[] = []
  private log: debug.IDebugger
  private sqlLog: debug.IDebugger
  private sqlResult: any

  constructor(config: IParserConfig) {
    this.config = config
    this.log = debug('GQL2SQL:parser:default')
    this.sqlLog = debug('GQL2SQL:parser:sequilize')
  }
  /**
   *
   * @param tableName
   */
  private getTable(tableName: string): ItableDefinition {
    return this.tables.find(t => t.name === tableName)
  }

  /**
   *
   * @param tableName
   * @param data
   */
  private setTable(tableName: string, data: {} | ItableDefinition = {}) {
    if (!this.getTable(tableName)) {
      this.tables.push({
        columns: {},
        name: tableName,
        relations: [],
      })
    } else {
      this.tables.map(t => {
        if (t.name === tableName) {
          t = {...t, ...data}
        }
      })
    }
    return this
  }

  /**
   *
   * @param tableName
   * @param relationName
   * @param data
   */
  private setRelation(tableName: string, data: ITableRelation) {
    let table = this.getTable(tableName)
    if (table.relations.length === 0) {
      table.relations.push(data)
    } else {
      table.relations.push(data)
    }

    this.setTable(tableName, table)
  }

  private setColumn(tableName: string, columnName: string, data: any) {
    let table = this.getTable(tableName)
    table.columns[columnName] = data

    this.setTable(tableName, table)
  }
  private setTables(types: IGQLType[]): any {
    types.map(t => {
      this.setTable(t.name)
    })
  }

  async run() {
    try {
      // parse the Graphql SDL
      const parsed = this.parseSchemaFromString(this.config.schema)
      const {types} = parsed

      appLog(`We have ${types.length} types to process. `)

      this.setTables(types)
      this.resolveColumDefinitions(types)
      this.resolveTableRelations(types)
      const tablesWithoutBsRelations = this.cleanRelations()
      await this.sequilize(tablesWithoutBsRelations)
      // this.applyAdapter()
    } catch (error) {
      appLog('ERROR ::: ', error)
    }
  }

  /**
   * Apply the adapter
   */
  applyAdapter() {
    // const adapter = Adapters.create(this.config.adapter)
    // adapter.configure({
    //   schema: this.config.database.syncOptions.schema,
    //   sqlResult: this.sqlResult,
    //   tables: this.tables,
    //   debug: this.config['debug'],
    // })
    // adapter.apply()
  }

  /**
   * Resolves the column definitions from prisma to simpler format we can use
   * @param types IGQLType[]
   */
  resolveColumDefinitions(types: IGQLType[]) {
    // logic inspired from https://github.com/prisma/prisma/blob/master/cli/packages/prisma-datamodel/src/datamodel/parser/parser.ts#L236

    // Find all the colum names and transform them into format for sequalize
    // ignore the relations
    for (const typeA of types) {
      const {name: tableName, fields} = typeA
      let table: ItableDefinition = this.getTable(tableName)

      for (const fieldA of fields) {
        if (typeof fieldA.type !== 'string') {
          continue // Assume relations
        }
        const column = this.transformField(fieldA)
        if (column) {
          table.columns[fieldA.name] = column
        }
      }
      this.setTable(tableName, table)
    }
  }

  /**
   * Resolves the type connections from prisma to simpler format we can use
   * @param types
   */
  resolveTableRelations(types: IGQLType[]) {
    // here is the code that resolves prisma relations, types and fields https://github.com/prisma/prisma/blob/master/cli/packages/prisma-datamodel/src/datamodel/parser/parser.ts#L251

    // Connect all relations
    for (const firstLevelType of types) {
      // don't lowercase here
      const {name: tableName} = firstLevelType

      let table: ItableDefinition = this.getTable(tableName)

      for (const firstLevelField of firstLevelType.fields) {
        const {
          name: columnName,
          relationName,
          relatedField,
          isList,
          isRequired,
          defaultValue,
          type,
        } = firstLevelField

        if (typeof type === 'string') {
          continue // Assume scalar
        }

        // don't lowercase here
        const {name: targetTable} = type

        if (relatedField && isList) {
          let computedRelationName =
            relationName || generateConnectingTable(tableName, targetTable)

          /**
           * if relatedField is not empty in prisma schema means that we do not have
           * the relationName declared in the table that we are connecting with
           * this means we have many-to-many relation
           */
          this.log(
            'n->m %s.%s to %s via %s',
            tableName,
            columnName,
            targetTable,
            computedRelationName,
          )

          this.setRelation(tableName, {
            isList: isList,
            fieldName: columnName,
            name: computedRelationName,
            target: targetTable,
            source: tableName,
          })
        } else {
          // Sequilize is rather limited when it comes to the belongsTo()
          // We are manually creating the Foreign Key ith defaultValue if provided
          // real world scenario is to create defaultValue = current_user_id() on owner_id
          this.log(
            `1->n relation ${tableName}.${columnName} to ${targetTable}.id`,
          )

          const columnFk = {
            fieldName: `${columnName}_id`,
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal(defaultValue),
            allowNull: !isRequired,
            references: {
              model: lowercaseFirstLetter(Utils.pluralize(targetTable)),
              key: 'id',
            },
          }
          this.setColumn(tableName, columnFk.fieldName, columnFk)
        }
      }

      this.setTable(tableName, table)
    }
  }

  parseSchemaFromString(schemaString: string) {
    const parser = prismaParser.create(DatabaseType[this.config.database.type])
    return parser.parseFromSchemaString(schemaString)
  }

  getSqlTypeFromPrisma(type) {
    let t = null
    if (typeof type !== 'string') {
      return t
    }

    switch (type) {
      case 'ID':
        t = Sequelize.INTEGER
        this.log('IDs are for now INTEGERS')
        break
      case 'DateTime':
        t = Sequelize.DATE
        break
      case 'Int':
        t = Sequelize.INTEGER
        break
      default:
        t = Sequelize[type.toUpperCase()]
        break
    }
    return t
  }

  getDefaultValueFromPrisma(defaultValue, type) {
    let t = null
    if (typeof type !== 'string') {
      return t
    }

    switch (type) {
      case 'DateTime':
        t = Sequelize.literal('NOW()')
        break
      case 'UUID':
        // https://www.postgresql.org/docs/10/pgcrypto.html
        t = Sequelize.literal('gen_random_uuid()')
        break
      default:
        t = defaultValue
        break
    }
    return t
  }

  transformField(field: IGQLField) {
    const {isId, type, defaultValue, isUnique, isRequired} = field

    let ret: DefineAttributeColumnOptions = {
      primaryKey: isId,
      defaultValue: this.getDefaultValueFromPrisma(defaultValue, type),
      type: this.getSqlTypeFromPrisma(type),
      unique: isUnique,
      allowNull: !isRequired,
    }
    if (type === 'ID') {
      ret.autoIncrement = true
      delete ret.defaultValue
    }

    return ret
  }
  protected cleanRelations(): ItableDefinition[] {
    const cleanedTables = []
    this.tables.map(sourceTable => {
      let {relations: relationsA, ...rest} = sourceTable
      let relations = []
      relationsA.forEach(firstLevelRelation => {
        const {isList, source, target} = firstLevelRelation

        const relatedTable = cleanedTables.find(t => t.name === target)
        //find the relation in target
        if (relatedTable) {
          const relatedRelation = relatedTable.relations.find(
            t => t.target === source && t.source === target,
          )
          if (relatedRelation) {
            return null
          }
        }

        if (isList) {
          relations.push(firstLevelRelation)
        } else {
          this.log(
            'Got the relation which I donno how to use',
            firstLevelRelation,
          )
        }
      })
      cleanedTables.push({
        ...rest,
        relations,
      })
    })
    return cleanedTables
  }

  /**
   * Loop through tables and runs Sequilize to generate table definitions and ultimately tables
   *
   * Calls raw query to create extension `uuid-ossp` needed for generation of UUIDV4
   * @param cleanedTables ItableDefinition[]
   */
  async sequilize(cleanedTables: ItableDefinition[]) {
    return new Promise(async (resolve, reject) => {
      let definedTables = {}
      const queriesToRunAfterSync = []
      const {connection, syncOptions} = this.config.database
      // Create extension that will be used to create uuids
      await connection.query(`
      set search_path to public;

      CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
      CREATE EXTENSION IF NOT EXISTS citext;
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      `)
      // await connection.query(
      //   `create or replace function public.user_full_name(users public.users) returns text as $$
      //   select users.given_name || ' ' || users.family_name
      // $$ language sql stable;

      // comment on function public.user_full_name(public.users) is 'A person’s full name which is a concatenation of their first and last name.';
      //     `,
      // )
      await connection.query(
        `CREATE OR REPLACE FUNCTION public.update_updated_at_column()
         RETURNS TRIGGER AS $$
         BEGIN
         NEW."updated_at" = now();
           RETURN NEW;
           END;
          $$ language plpgsql;
          `,
      )

      await connection.query(
        `CREATE OR REPLACE FUNCTION public.current_user_id ()
        RETURNS UUID AS $userId$
        declare
          userId UUID;
        BEGIN
           SELECT id into userId FROM public.users where auth0id=current_setting('user.auth0id')::text;
           RETURN userId;
        END;
        $userId$ LANGUAGE plpgsql;
        comment on function  public.current_user_id() is
        E'@omit\nHandy method to get the current user ID for use in RLS policies, etc; in GraphQL, use currentUser{id} instead.';
        `,
      )
      const queryInterface = connection.getQueryInterface()
      // prepare definitions
      await cleanedTables.forEach(table => {
        const {columns, name} = table
        if (!definedTables[name]) {
          definedTables[name] = connection.define(
            lowercaseFirstLetter(name),
            columns,
            {
              // freezeTableName: true, // this makes plural tables
              // comment: `I am a ${name}`,
              hasTrigger: true,
            },
          )
        }
      })

      Promise.all(
        cleanedTables.map(table => {
          return new Promise(async (resolve, reject) => {
            const {name, relations} = table
            const sourceTable = lowercaseFirstLetter(name)
            try {
              await queryInterface.dropTrigger(
                `"${sourceTable}"`,
                `update_${sourceTable}_updatedAt_column`,
              )
              await queryInterface.createTrigger(
                `"${sourceTable}"`,
                `update_${sourceTable}_updated_at_column`,
                'before',
                ['update'],
                'update_updated_at_column',
                [],
                ['FOR EACH ROW'],
                {},
              )
            } catch (error) {
              // ignore error here, so what if it cant delete something that is not there
              // appLog(error)
            }

            if (relations) {
              relations.forEach(relation => {
                const {
                  isList,
                  name: relationName,
                  target,
                  source,
                  fieldName,
                } = relation
                if (!definedTables[target]) {
                  this.log('Relation model %s is not processed yet', target)
                  return
                }
                const targetTable = lowercaseFirstLetter(target)
                // if (!isList) {
                //   this.sqlLog(
                //     '1->n %s.%s to %s.id',
                //     sourceTable,
                //     fieldName,
                //     target,
                //   )
                //   // 1:n relation
                //   definedTables[source].belongsTo(definedTables[target], {
                //     as: fieldName,
                //     constraints: false,
                //   })
                // }
                if (isList) {
                  const sourceTablePluralized = generateTableName(sourceTable)
                  const targetTablePluralized = generateTableName(targetTable)
                  const through = generateConnectingTable(
                    sourceTable,
                    targetTable,
                  )
                  const throughBack = `${targetTablePluralized}_${sourceTablePluralized}`
                  this.sqlLog(
                    'n->m %s.%s to %s via %s ',
                    sourceTable,
                    fieldName,
                    targetTable,
                    through,
                  )
                  definedTables[source].belongsToMany(definedTables[target], {
                    through,
                    // constraints: false,
                  })
                  queriesToRunAfterSync.push(
                    `comment on table ${through} is E'@omit';`,
                  )

                  queriesToRunAfterSync.push(
                    `create function ${through}(${sourceTablePluralized}) returns setof ${targetTablePluralized} as $$
                    select ${targetTablePluralized}.* from ${targetTablePluralized} inner join ${through} on (${through}.${targetTable}_id = ${targetTablePluralized}.id) where ${through}.${sourceTable}_id = $1.id;
                  $$ language sql stable set search_path from current;
                    `,
                  )
                  queriesToRunAfterSync.push(
                    `create function ${throughBack}(${targetTablePluralized}) returns setof ${sourceTablePluralized} as $$
                      select ${sourceTablePluralized}.* from ${sourceTablePluralized} inner join ${through} on (${through}.${sourceTable}_id = ${sourceTablePluralized}.id) where ${through}.${targetTable}_id = $1.id;
                    $$ language sql stable set search_path from current;
                      `,
                  )
                  console.log(queriesToRunAfterSync)
                }
              })
            }

            resolve(true)
          })
        }),
      ).then(() => {
        // Promise has issue with this being this, so that is new this :D
        let that = this

        connection
          .sync(syncOptions)
          .then(async d => {
            await queriesToRunAfterSync.map(async q => {
              try {
                await connection.query(q)
              } catch (error) {
                console.error(error)
              }
            })

            resolve(d)
          })
          .catch(error => {
            reject(error)
          })
      })
    })
  }
}
