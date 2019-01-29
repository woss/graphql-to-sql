import {IGQLField, Parser, DatabaseType} from 'prisma-datamodel'
import Sequelize, {DefineAttributeColumnOptions} from 'sequelize'
import {readFileSync} from 'fs'
import {ITableRelation} from './interfaces'

export const loadSchemaFromFile = (filePath: string) => {
  return readFileSync(filePath).toString()
}

export const parseSchemaFromString = (schemaString: string) => {
  const parser = Parser.create(DatabaseType.postgres)
  return parser.parseFromSchemaString(schemaString)
}

export const generateColumn = (prismaField: any | IGQLField) => {
  const {name, type} = prismaField
  if (!isRelation(prismaField)) {
    console.log('       generating column for %s', name)
    const ret = transformField(prismaField)
    return ret
  }
}

export const generateRelation = (
  tableName: string,
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
  }
}

export const getSqlTypeFromPrisma = type => {
  let t = null
  if (typeof type !== 'string') {
    return t
  }

  switch (type) {
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
      t = Sequelize.NOW
      break
    case 'UUID':
      t = Sequelize.UUIDV4
      break
    default:
      t = defaultValue
      break
  }
  return t
}

export const transformField = (field: IGQLField) => {
  const {isId, name, isRequired, type, defaultValue, isUnique} = field

  let ret: DefineAttributeColumnOptions = {
    primaryKey: isId,
    defaultValue: getDefaultValueFromPrisma(defaultValue, type),
    type: getSqlTypeFromPrisma(type),
    unique: isUnique,
  }

  return ret
}
