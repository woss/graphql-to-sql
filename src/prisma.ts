import {IGQLField, Parser, DatabaseType} from 'prisma-datamodel'
import Sequelize from 'sequelize'
import {readFileSync} from 'fs'

export const loadSchemaFromFile = (filePath: string) => {
  return readFileSync(filePath).toString()
}

export const parseSchemaFromString = (schemaString: string) => {
  const parser = Parser.create(DatabaseType.postgres)
  return parser.parseFromSchemaString(schemaString)
}

export const generateColumn = (
  modelName: string,
  prismaField: any | IGQLField,
): {fields?: {}; relations?: {}} => {
  const {name, type} = prismaField

  let fields = {}
  let ret = {}
  if (!isRelation(prismaField)) {
    console.log('       generating column for %s', name)
    ret['fields'] = transformField(prismaField)
  } else if (typeof type === 'object') {
    console.log('     relation encountered %s creating model defition', name)
    ret = processPrismaRelation(modelName, prismaField)
  }

  return ret
}
export const isRelation = (field: IGQLField): Boolean => {
  const {type} = field
  return typeof type === 'object'
}

export const processPrismaRelation = (
  originalModelName: string,
  prismaField: IGQLField,
): any => {
  // table fields and possible relations
  const {fields} = prismaField.type as any
  const {name: relationFieldName, relationName, isList} = prismaField

  let columns = {}
  fields.forEach(f => {
    const {
      name,
      type: {name: modelName},
    } = f
    if (isRelation(f)) {
      if (originalModelName === modelName) {
        console.log('    circular relation', modelName, name)
        return
      }
      columns[name] = generateColumn(originalModelName, f)
    }
    columns[name] = generateColumn(originalModelName, f)
  })

  if (isList) {
    console.log('     %s is a n:n relation', relationFieldName)
  } else {
    console.log('     %s is a 1:1 relation', relationFieldName)
  }

  return {
    fields: columns,
    relations: {
      relationName,
      relationFieldName,
      isList,
      target: relationFieldName,
    },
  }
}

export const createRelation = (source, target) => {}
export const getSqlTypeFromPrisma = type => {
  let t = null
  switch (type) {
    case 'UUID':
      t = Sequelize.UUID
      break
    default:
      break
  }
  return t
}
export const transformField = ({isId, name, isRequired, type}: IGQLField) => {
  let sqlType = getSqlTypeFromPrisma(type)
  let ret = {
    primaryKey: false,
    type: sqlType,
  }

  if (isId) {
    ret.primaryKey = true
  }
  return ret
}
