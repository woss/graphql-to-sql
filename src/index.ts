import Sequelize from 'sequelize'

const seq = new Sequelize('gql', 'root', 'prisma', {
  host: 'localhost',
  port: 55432,
  dialect: 'postgres',
})

import {resolve} from 'path'

import {IGQLType, IGQLField} from 'prisma-datamodel'
import {
  generateColumn,
  parseSchemaFromString,
  loadSchemaFromFile,
} from './prisma'

export let schemaString = loadSchemaFromFile(
  resolve(__dirname, './test.schema.graphql'),
)

export const parsedSchema = parseSchemaFromString(schemaString)

const {types} = parsedSchema

export const generateTableName = (field: string | IGQLField): string => {
  if (typeof field === 'string') {
    return field.toLowerCase()
  }
  const {type, name} = field
  if (typeof type !== 'string') {
    return type.name.toLowerCase()
  } else {
    return name.toLowerCase()
  }
}

const sqlTables = {}
types.map(table => {
  let {name: modelName, fields: prismaFields} = table
  console.log('Processing %s', modelName)
  if (!sqlTables.hasOwnProperty(modelName)) {
    if (prismaFields) {
      let columnDefinition = {fields: {}, relations: {}}
      prismaFields.forEach(field => {
        console.log('   column %s', field.name)
        const {fields, relations} = generateColumn(modelName, field)
        if (relations) {
          // if this is the case fields is the definition of linked model and we must add it to the table definition list, later we create foreign key
          // maybe we reverse relation here???
          const connectedTableName = generateTableName(field)
          sqlTables[connectedTableName] = {fields}
          columnDefinition.relations[field.name] = {
            ...relations,
            target: connectedTableName,
          }
        } else {
          columnDefinition.fields[field.name] = fields
        }
      })

      sqlTables[generateTableName(modelName)] = columnDefinition
    }
  }
  console.log('-------------------------------------------------------')
})
let definedTables = {}

// prepare definitions
Object.keys(sqlTables).map(key => {
  const {fields, relations} = sqlTables[key]

  if (!definedTables[key]) {
    definedTables[key] = seq.define(key, fields)
  }
  if (relations) {
    Object.keys(relations).map(relationKey => {
      const {isList, relationName, target} = relations[relationKey]
      if (!definedTables[relationKey]) {
        console.error('   Relation model %s is not processed yet', relationKey)
        return
      }
      if (!isList) {
        // 1:1 relation
        definedTables[key].belongsTo(definedTables[target])
      } else {
        console.log('we have a list %', relationKey)
        definedTables[key].hasMany(definedTables[target])
      }
    })
  }
})

seq
  .sync({force: true})
  .then(d => {})
  .catch(err => {
    console.error(err)
  })
