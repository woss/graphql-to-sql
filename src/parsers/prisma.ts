import {
  IGQLField,
  Parser as prismaParser,
  DatabaseType,
  IGQLType,
} from 'prisma-datamodel'
import Sequelize, {DefineAttributeColumnOptions} from 'sequelize'
import {ITableRelation, ItableDefinition, IParserConfig} from '../interfaces'
import Parser from './parser'
import Adapters from '../adapters'
import debug from 'debug'
import {appLog} from '..'

export default class PrismaParser extends Parser {
  private config: IParserConfig
  private tables: ItableDefinition[] = []
  private log: debug.IDebugger
  private sqlLog: debug.IDebugger
  private sqlResult: any

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
  private setRelation(
    tableName: string,
    relationName: string,
    data: ITableRelation,
  ) {
    let table = this.getTable(tableName)
    if (table.relations.length === 0) {
      table.relations.push(data)
    } else {
      table.relations.push(data)
    }

    this.setTable(tableName, table)
  }

  private setTables(types: IGQLType[]): any {
    types.map(t => {
      this.setTable(t.name)
    })
  }
  configure(config: IParserConfig) {
    this.config = config
    this.log = debug('GQL2SQL:parser:prisma')
    this.sqlLog = debug('GQL2SQL:parser:sequilize')
  }

  async run() {
    try {
      const {types} = this.parseSchemaFromString(this.config.schemaString)

      appLog(`We have ${types.length} types to process. `)

      this.setTables(types)
      this.resolveColumDefinitions(types)
      this.resolveTableRelations(types)
      const tablesWithoutBsRelations = this.cleanRelations()
      await this.sequilize(tablesWithoutBsRelations)
      this.applyAdapter()
    } catch (error) {
      appLog('ERROR ::: ', error)
    }
  }

  /**
   * Loop through tables and runs Sequilize to generate table definitions and ultimately tables
   *
   * Calls raw query to create extension `uuid-ossp` needed for generation of UUIDV4
   * @param cleanedTables ItableDefinition[]
   */
  async sequilize(cleanedTables: ItableDefinition[]) {
    return new Promise((resolve, reject) => {
      let definedTables = {}
      const {connection, syncOptions} = this.config.database

      // prepare definitions
      cleanedTables.forEach(table => {
        const {columns, name} = table

        if (!definedTables[name]) {
          definedTables[name] = connection.define(name, columns, {
            freezeTableName: true,
          })
        }
      })

      cleanedTables.forEach(table => {
        const {name: tableName, relations} = table
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

            if (!isList) {
              this.sqlLog(
                'Creating relation %s 1->n %s through %s',
                tableName,
                target,
                fieldName,
              )

              // 1:1 relation
              definedTables[source].belongsTo(definedTables[target], {
                as: fieldName,
              })
            } else {
              this.sqlLog(
                'Creating relation %s n->m %s through %s',
                tableName,
                target,
                fieldName,
              )
              definedTables[source].belongsToMany(definedTables[target], {
                through: relationName,
              })
            }
          })
        }
      })

      // Create extension that will be used to create uuids
      connection.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

      // Promise has issue with this being this, so that is new this :D
      let that = this

      connection
        .sync(syncOptions)
        .then(d => {
          that.sqlResult = d
          resolve(d)
        })
        .catch(error => {
          reject(error)
        })
    })
  }

  /**
   * Apply the adapter
   */
  applyAdapter() {
    const adapter = Adapters.create(this.config.adapter)
    adapter.configure({
      schema: this.config.database.syncOptions.schema,
      sqlResult: this.sqlResult,
      tables: this.tables,
      debug: this.config['debug'],
    })

    adapter.apply()
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
   * Resolves the type connectionsfrom prisma to simpler format we can use
   * @param types
   */
  resolveTableRelations(types: IGQLType[]) {
    // here is the code that resolves prisma relations, types and fields https://github.com/prisma/prisma/blob/master/cli/packages/prisma-datamodel/src/datamodel/parser/parser.ts#L251

    // Connect all relations
    for (const firstLevelType of types) {
      const {name: tableName} = firstLevelType

      let t = firstLevelType

      let table: ItableDefinition = this.getTable(tableName)

      for (const firstLevelField of firstLevelType.fields) {
        const {
          name: columnName,
          relationName,
          relatedField,
          isList,
          type,
        } = firstLevelField

        if (typeof type === 'string') {
          continue // Assume scalar
        }

        const {name: targetTable} = type

        if (relationName && !relatedField) {
          /**
           * if  relatedField is empty in prisma schema means that we do not have
           * the relationName declared in the table that we are connecting with
           */
          this.log('%s to %s through %s', tableName, targetTable, columnName)
          this.setRelation(tableName, columnName, {
            isList: isList,
            fieldName: columnName,
            name: relationName,
            target: targetTable,
            source: tableName,
          })
        } else if (relationName && relatedField) {
          /**
           * if  relatedField is empty in prisma schema means that we do not have
           * the relationName declared in the table that we are connecting with
           * this means we have many-to-many relation
           */
          this.log(
            '%s to %s through %s via %s',
            tableName,
            targetTable,
            columnName,
            relationName,
          )
          this.setRelation(tableName, columnName, {
            isList: isList,
            fieldName: columnName,
            name: relationName,
            target: targetTable,
            source: tableName,
          })
        } else {
          this.log(
            'Skipping .... %s type does not have a relation',
            targetTable,
          )
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
        t = Sequelize.literal('CURRENT_TIMESTAMP')
        break
      case 'UUID':
        t = Sequelize.literal('uuid_generate_v4()')
        break
      default:
        t = defaultValue
        break
    }
    return t
  }

  transformField(field: IGQLField) {
    const {isId, type, defaultValue, isUnique} = field

    let ret: DefineAttributeColumnOptions = {
      primaryKey: isId,
      defaultValue: defaultValue
        ? Sequelize.literal(defaultValue)
        : this.getDefaultValueFromPrisma(defaultValue, type),
      type: this.getSqlTypeFromPrisma(type),
      unique: isUnique,
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

        if (!isList) {
          // find relation table based on target field
          const relatedTable = this.tables.find(t => t.name === target)
          if (relatedTable) {
            const relatedRelation = relatedTable.relations.find(
              t => t.target === source && t.source === target,
            )

            if (relatedRelation) {
              const relationAlreadyProcessed = cleanedTables.find(t => {
                if (t.name === target) {
                  return t.relations.find(r => r.name === relatedRelation.name)
                }
              })
              if (!relationAlreadyProcessed) {
                relations.push(firstLevelRelation)
              }
            } else {
              relations.push(firstLevelRelation)
            }
          }
        } else {
          relations.push(firstLevelRelation)
        }
      })
      cleanedTables.push({
        ...rest,
        relations,
      })
    })
    return cleanedTables
  }
}
