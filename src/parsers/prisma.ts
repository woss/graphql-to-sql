import {
  IGQLField,
  Parser as prismaParser,
  DatabaseType,
  IGQLType,
} from 'prisma-datamodel'
import Sequelize, {DefineAttributeColumnOptions} from 'sequelize'
import {
  ITableRelation,
  ItableDefinitions,
  ItableDefinition,
  IParserConfig,
  IAdaptersTypes,
} from '../interfaces'
import Parser from './parser'
import Adapters from '../adapters'
import HasuraAdapter from '../adapters/hasura'

export default class PrismaParser extends Parser {
  private config: IParserConfig
  private tables: ItableDefinitions = {}

  private getTable(tableName): ItableDefinition {
    return this.tables[tableName]
  }
  private setTable(tableName, data: {} | ItableDefinition = {}) {
    let table = this.getTable(tableName)
    if (!table) {
      table = this.tables[tableName] = {
        columns: {},
        name: tableName,
        relations: {},
      }
    } else {
      table = {...table, ...data}
    }
    return table
  }

  private getRelation(tableName: string, relationName: string): ITableRelation {
    let table = this.getTable(tableName)
    if (!table) {
      table = this.setTable(tableName)
    }
    return table.relations[relationName]
  }
  private setRelation(
    tableName: string,
    relationName: string,
    data: ITableRelation,
  ) {
    let table = this.getTable(tableName)
    table.relations[relationName] = data
    this.setTable(tableName, table)
  }

  configure(config: IParserConfig) {
    this.config = config
  }

  parse() {
    const {types, comments} = this.parseSchemaFromString(
      this.config.schemaString,
    )
    this.resolveColumDefinitions(types)
    this.resolveTableRelations(types)
    this.applyAdapters()
    this.sequilize()
  }

  sequilize() {
    console.log('do it')
  }

  applyAdapters() {
    if (this.config.adapters.length > 1) {
      throw new Error('Currently we are only supporting one adapter.')
    }

    for (const a of this.config.adapters) {
      const adapter = Adapters.create(a)
      adapter.cleanRelations(this.tables)
    }
    return
  }

  resolveColumDefinitions(types: IGQLType[]) {
    // borrowed from https://github.com/prisma/prisma/blob/master/cli/packages/prisma-datamodel/src/datamodel/parser/parser.ts#L236

    // Find all the colum names and transform them into format for sequalize
    // ignore the relations
    for (const typeA of types) {
      const {name: tableName, fields} = typeA
      let table: ItableDefinition = this.setTable(tableName)

      for (const fieldA of fields) {
        if (typeof fieldA.type !== 'string') {
          continue // Assume relations
        }
        const column = transformField(fieldA)
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

      let table: ItableDefinition = this.setTable(tableName, {relations: {}})

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
    const parser = prismaParser.create(DatabaseType[this.config.databaseType])
    return parser.parseFromSchemaString(schemaString)
  }
}

export const getSqlTypeFromPrisma = type => {
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

export const getDefaultValueFromPrisma = (defaultValue, type) => {
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

export const transformField = (field: IGQLField) => {
  const {isId, type, defaultValue, isUnique} = field

  let ret: DefineAttributeColumnOptions = {
    primaryKey: isId,
    defaultValue: defaultValue
      ? Sequelize.literal(defaultValue)
      : getDefaultValueFromPrisma(defaultValue, type),
    type: getSqlTypeFromPrisma(type),
    unique: isUnique,
  }
  if (type === 'ID') {
    ret.autoIncrement = true
    delete ret.defaultValue
  }

  return ret
}
