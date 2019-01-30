import {
  IGQLField,
  Parser as prismaParser,
  DatabaseType,
  ISDL,
  IGQLType,
} from 'prisma-datamodel'
import Sequelize, {DefineAttributeColumnOptions} from 'sequelize'
import {
  ITableRelation,
  ItableDefinitions,
  ItableDefinition,
} from '../interfaces'
import Parser from './parser'
import {IParserConfig} from './interfaces'

export default class PrismaParser extends Parser {
  private config: IParserConfig
  private tables: ItableDefinitions = {}
  configure(config: IParserConfig) {
    this.config = config
  }
  parse() {
    const {types, comments} = this.parseSchemaFromString(
      this.config.schemaString,
    )
    this.resolveColumDefinitions(types)
    this.resolveTableRelations(types)
  }

  resolveColumDefinitions(types: IGQLType[]) {
    // borrowed from https://github.com/prisma/prisma/blob/master/cli/packages/prisma-datamodel/src/datamodel/parser/parser.ts#L236

    // Find all the colum names and transform them into format for sequalize
    // ignore the relations
    for (const typeA of types) {
      const {name: tableName} = typeA
      let table: ItableDefinition = {
        name: tableName,
        columns: {},
      }
      for (const fieldA of typeA.fields) {
        // console.log(fieldA)
        const column = generateColumn(fieldA)
        if (column) {
          table.columns[fieldA.name] = column
        }
      }
      this.tables[tableName] = table
    }
  }
  resolveTableRelations(types: IGQLType[]) {
    // borrowed from https://github.com/prisma/prisma/blob/master/cli/packages/prisma-datamodel/src/datamodel/parser/parser.ts#L251

    // Connect all relations that are only one way.
    // in graphql model Photo has a user but user doesn't have a photo
    for (const typeA of types) {
      const {name: tableName} = typeA
      let table: ItableDefinition = {...this.tables[tableName], relations: {}}
      for (const fieldA of typeA.fields) {
        const {name: columnName, relationName} = fieldA
        if (typeof fieldA.type === 'string') {
          continue // Assume scalar
        }

        if (fieldA.relationName !== null && fieldA.relatedField === null) {
          // this is 1:n relationship
          table.relations[columnName] = {
            isList: fieldA.isList,
            relationFieldName: columnName,
            relationName,
            target: fieldA.type.name,
            source: typeA.name,
          }
          for (const fieldB of fieldA.type.fields) {
            // This is the connection that makes connected tables
            if (fieldB.relationName === fieldA.relationName) {
              if (fieldB.type !== typeA) {
                throw new Error(
                  `Relation type mismatch for relation ${fieldA.relationName}`,
                )
              }
              fieldA.relatedField = fieldB
              fieldB.relatedField = fieldA
              break
            }
          }
        }
      }
      // now we have the list of relations that are only defined in one of the models.
      // Example: Photo -> User, but User !-> Photo in the gql definition
      // At the DB level, since there is a FK from Photo -> User, mapping table is not needed because we can always get the users photos by making the query in the photos table with USER.ID
      this.tables[tableName] = table
    }
  }

  parseSchemaFromString(schemaString: string) {
    const parser = prismaParser.create(DatabaseType[this.config.databaseType])
    return parser.parseFromSchemaString(schemaString)
  }
}
export const generateColumn = (prismaField: IGQLField) => {
  const {name, type} = prismaField
  if (!isRelation(prismaField)) {
    console.log('       generating column for %s', name)
    const ret = transformField(prismaField)
    return ret
  }
}

export const generateRelation = (
  prismaField: any | IGQLField,
): ITableRelation => {
  const {name, type} = prismaField
  if (!isRelation(prismaField)) {
    return
  }

  console.log('     relation encountered %s creating model defition', name)
  const relation = processPrismaRelation(prismaField)
  return relation
}

export const isRelation = (field: IGQLField): Boolean => {
  const {type} = field
  return typeof type === 'object'
}

export const processPrismaRelation = (
  prismaField: IGQLField,
): ITableRelation => {
  // table fields and possible relations
  const {fields, name: modelName} = prismaField.type as any
  const {name: relationFieldName, relationName, isList} = prismaField
  if (isList) {
    console.log('     %s is a n:n relation', relationFieldName)
  } else {
    console.log('     %s is a 1:1 relation', relationFieldName)
  }

  return {
    relationName,
    relationFieldName,
    isList,
    target: modelName,
    source: modelName,
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
