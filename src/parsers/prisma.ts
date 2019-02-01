import {
  IGQLField,
  Parser as prismaParser,
  DatabaseType,
  IGQLType,
} from 'prisma-datamodel'
import Sequelize, {DefineAttributeColumnOptions} from 'sequelize'
import {
  ITableRelation,
  ItableDefinition,
  IParserConfig,
  IAdaptersTypes,
} from '../interfaces'
import Parser from './parser'
import Adapters from '../adapters'
import {generateTableName} from '../util/utils'

export default class PrismaParser extends Parser {
  private config: IParserConfig
  private tables: ItableDefinition[] = []
  sqlResult: any

  private setTables(tables: ItableDefinition[]) {
    this.tables = tables
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
  private setRelation(
    tableName: string,
    relationName: string,
    data: ITableRelation,
  ) {
    let table = this.getTable(tableName)
    if (table.relations.length === 0) {
      table.relations.push(data)
    } else {
      table.relations.map(r => {
        if (r.name === relationName) {
          r = data
        }
      })
    }

    this.setTable(tableName, table)
  }

  configure(config: IParserConfig) {
    this.config = config
  }

  /**
   * Main entry point for the parser
   */
  async parse() {
    const {types} = this.parseSchemaFromString(this.config.schemaString)

    this.createTables(types)
    this.resolveColumDefinitions(types)
    this.resolveTableRelations(types)
    const tablesWithoutBsRelations = this.cleanupForAdapters()
    await this.sequilize(tablesWithoutBsRelations)
    this.applyAdapter()
  }
  createTables(types: IGQLType[]): any {
    types.map(t => {
      this.setTable(t.name)
    })
  }

  async sequilize(cleanedTables) {
    return new Promise((resolve, reject) => {
      let definedTables = {}
      const {connection, syncOptions} = this.config.database

      // prepare definitions
      this.tables.forEach(table => {
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

            console.log(
              'Relation %s->%s through %s',
              tableName,
              target,
              relationName,
            )

            if (!definedTables[target]) {
              console.error('   Relation model %s is not processed yet', target)
              return
            }
            if (!isList) {
              // 1:1 relation
              definedTables[source].belongsTo(definedTables[target], {
                as: fieldName,
              })
            } else {
              console.log('   hasMany', relationName)
              definedTables[source].belongsToMany(definedTables[target], {
                through: relationName,
              })
              // definedTables[target].belongsToMany(definedTables[key], {
              //   through: relationName,
              // })
            }
          })
        }
      })

      connection
        .query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
        .spread((results, metadata) => {
          console.log(results, metadata)
        })
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

  cleanupForAdapters(): ItableDefinition[] {
    const adapter = Adapters.create(this.config.adapter)
    return adapter.cleanup(this.tables)
  }

  applyAdapter() {
    const adapter = Adapters.create(this.config.adapter)
    adapter.configure({
      schema: this.config.database.syncOptions.schema,
      sqlResult: this.sqlResult,
      tables: this.tables,
      apiEndpoint: 'http://localhost:8080',
    })
    adapter.apply()
  }

  resolveColumDefinitions(types: IGQLType[]) {
    // borrowed from https://github.com/prisma/prisma/blob/master/cli/packages/prisma-datamodel/src/datamodel/parser/parser.ts#L236

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

  resolveTableRelations(types: IGQLType[]) {
    // here is the code that resolves prisma relations, types and fields https://github.com/prisma/prisma/blob/master/cli/packages/prisma-datamodel/src/datamodel/parser/parser.ts#L251

    // Connect all relations
    for (const typeA of types) {
      const {name: tableName} = typeA

      let table: ItableDefinition = this.getTable(tableName)

      for (const fieldA of typeA.fields) {
        const {name: columnName, relationName} = fieldA

        if (typeof fieldA.type === 'string') {
          continue // Assume scalar
        }
        if (relationName) {
          this.setRelation(tableName, columnName, {
            isList: fieldA.isList,
            fieldName: columnName,
            name: relationName,
            target: fieldA.type.name,
            source: tableName,
          })
        }
      }

      // now we have the list of relations that are only defined in one of the models.
      // Example: Photo -> User, but User !-> Photo in the gql definition
      // At the DB level, since there is a FK from Photo -> User, mapping table is not needed because we can always get the users photos by making the query in the photos table with USER.ID

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
        console.log('IDs are for now INTEGERS')
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
}
