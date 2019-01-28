import {Parser, DatabaseType, IGQLType} from 'prisma-datamodel'
import {readFileSync} from 'fs'
import {resolve} from 'path'
import * as Sequelize from 'sequelize'

var seq = new Sequelize('gql', 'root', 'prisma', {
  host: 'localhost',
  port: 55432,
  dialect: 'postgres',
})

const schemaPath = resolve(__dirname, './schema.graphql')
const schemaString = readFileSync(schemaPath).toString()

const parser = Parser.create(DatabaseType.postgres)
const parsedSchema = parser.parseFromSchemaString(schemaString)
const {types} = parsedSchema

const convertFieldsFromPrismaToOur = field => {
  console.log(field)
}
/**
 * a list of tables that need to be generated
 */
interface TableItem {
  name: string
  value: {}
}

let tablesHolder = types.map(t => {
  return {
    name: t.name.toLowerCase(),
    prisma: t,
    relations: {},
    fields: {},
  }
})

tablesHolder.forEach(table => {
  // const {name: tableName, fields} = type
  // console.log('Processing %s', tableName)
  // let tableFields = {}
  // fields.map(field => {
  //   const {
  //     type,
  //     name,
  //     defaultValue,
  //     isId,
  //     isRequired,
  //     isUnique,
  //     relationName,
  //     relatedField,
  //   } = field
  //   let ret = {
  //     primaryKey: isId,
  //     type: type === 'UUID' ? Sequelize.UUID : Sequelize.STRING,
  //     field: name,
  //     defaultValue: defaultValue || Sequelize.UUIDV4,
  //     allowNull: !isRequired,
  //     unique: isUnique,
  //   }
  //   // this is a relation
  //   if (relationName) {
  //     if (relatedField) {
  //       const {isList, relatedField: _relatedField, name} = relatedField
  //       console.log('Got List for the relation %s', name)
  //     } else {
  //       // 1:1 relation
  //       const typeObj: any = Object.assign({}, type)
  //       console.log('Got 1:1 for the relation %s', name)
  //     }
  //   } else {
  //     tableFields[name] = ret
  //   }
  // })
  //   tables.push({
  //     name: tableName.toLocaleLowerCase(),
  //     value: seq.define(tableName.toLocaleLowerCase(), tableFields),
  //   })
})

// seq
//   .sync({force: true})
//   .then(d => {})
//   .catch(err => {
//     console.error(err)
//   })
