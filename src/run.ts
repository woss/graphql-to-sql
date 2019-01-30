/**
 * this is helper for cli running, dev purposes only
 */
import Sequelize from 'sequelize'
import {resolve} from 'path'
import Parsers from './parsers'
import {DatabaseTypes} from './parsers/interfaces'
import {readFileSync} from 'fs'

const parser = Parsers.create()
parser.configure({
  schemaString: readFileSync(
    resolve(__dirname, './__tests__/schemas/test.schema.graphql'),
  ).toString(),
  adapters: [],
  databaseType: DatabaseTypes.postgres,
})

parser.parse()

// const sqlTables: ISqlTable = {}

// types.map(table => {
//   let {name: modelName, fields: prismaFields} = table
//   console.log('Processing prisma type %s', modelName)
//   if (!sqlTables.hasOwnProperty(modelName)) {
//     if (prismaFields) {
//       let tableDefinition: ItableDefinition = {fields: {}, relations: {}}

//       prismaFields.forEach(field => {
//         const {name: fieldName} = field

//         console.log('   column %s', fieldName)

//         // generate only fields definition for table, without relations
//         const tableField = generateColumn(field)
//         if (tableField) {
//           tableDefinition.fields[fieldName] = tableField
//         } else {
//           const tableRelation = generateRelation(field)
//           if (tableRelation) {
//             tableDefinition.relations[fieldName] = tableRelation
//           }
//         }
//       })

//       sqlTables[modelName] = tableDefinition
//     }
//   }
//   console.log('-------------------------------------------------------')
// })

// const seq = new Sequelize('gql', 'root', 'prisma', {
//   host: 'localhost',
//   port: 55432,
//   dialect: 'postgres',
// })

// let definedTables = {}

// // prepare definitions
// Object.keys(sqlTables).map(key => {
//   const {fields} = sqlTables[key]

//   if (!definedTables[key]) {
//     definedTables[key] = seq.define(generateTableName(key), fields, {
//       freezeTableName: true,
//     })
//   }
// })

// Object.keys(sqlTables).map(key => {
//   const {relations} = sqlTables[key]
//   if (relations) {
//     Object.keys(relations).map(relationKey => {
//       const {isList, relationName, target} = relations[relationKey]

//       console.log('Relation %s->%s through %s', key, target, relationKey)

//       if (!definedTables[target]) {
//         console.error('   Relation model %s is not processed yet', target)
//         return
//       }
//       if (!isList) {
//         // 1:1 relation
//         definedTables[key].belongsTo(definedTables[target])
//       } else {
//         console.log('   hasMany', relationKey)
//         definedTables[key].belongsToMany(definedTables[target], {
//           through: relationName,
//         })
//         // definedTables[target].belongsToMany(definedTables[key], {
//         //   through: relationName,
//         // })
//       }
//     })
//   }
// })

// seq
//   // .query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
//   // .then(q=>{})
//   .sync({force: true})
//   .then(d => {
//     const a = 1
//   })
//   .catch(err => {
//     console.error(err)
//   })
