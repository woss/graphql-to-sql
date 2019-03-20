/**
 * this is helper for cli running, dev purposes only
 */

require('dotenv').config()

import {resolve} from 'path'
import Parsers from './parsers'
import {DatabaseTypes, IAdaptersTypes} from './interfaces'
import {readFileSync} from 'fs'
import sequelize from 'sequelize'

const parser = Parsers.create()

const {
  POSTGRES_DB,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_HOST,
  POSTGRES_PORT,
  POSTGRES_PORT_FORWARDED,
  POSTGRES_LOGGING,
} = process.env

if (
  !POSTGRES_DB ||
  !POSTGRES_USER ||
  !POSTGRES_PASSWORD ||
  !POSTGRES_HOST ||
  !POSTGRES_PORT
) {
  throw new Error('Pleae set up the env variables')
}
console.log(
  POSTGRES_DB,
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_HOST,
  POSTGRES_PORT,
  POSTGRES_PORT_FORWARDED,
  POSTGRES_LOGGING,
)
const schema = 'public'
const seq = new sequelize(POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, {
  host: POSTGRES_HOST,
  port: parseInt(POSTGRES_PORT_FORWARDED || POSTGRES_PORT, 10),
  logging: !!POSTGRES_LOGGING,
  dialect: 'postgres',
  define: {
    timestamps: true,
  },
})

// seq.createSchema(schema, {})

parser.configure({
  schemaString: readFileSync(resolve(__dirname, '../schema.gql')).toString(),
  adapter: IAdaptersTypes.hasura,
  debug: true,
  database: {
    type: DatabaseTypes.postgres,
    connection: seq,
    syncOptions: {
      schema,
    },
  },
})

parser.run().catch(err => {
  console.error(err)
})
