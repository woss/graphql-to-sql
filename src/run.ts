/**
 * this is helper for cli running, dev purposes only
 */
import {resolve} from 'path'
import Parsers from './parsers'
import {DatabaseTypes, IAdaptersTypes} from './interfaces'
import {readFileSync} from 'fs'
import sequelize from 'sequelize'

const parser = Parsers.create()

const seq = new sequelize('gql', 'root', 'prisma', {
  host: 'localhost',
  port: 55432,
  dialect: 'postgres',
})

parser.configure({
  schemaString: readFileSync(
    resolve(__dirname, './__tests__/schemas/test.schema.graphql'),
  ).toString(),
  adapter: IAdaptersTypes.hasura,
  database: {
    type: DatabaseTypes.postgres,
    connection: seq,
    syncOptions: {
      force: true,
      schema: 'public',
    },
  },
})

parser.parse()
