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

const seq = new sequelize(POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, {
  host: POSTGRES_HOST,
  port: parseInt(POSTGRES_PORT_FORWARDED || POSTGRES_PORT, 10),
  logging: !!POSTGRES_LOGGING,
  dialect: 'postgres',
})

parser.configure({
  schemaString: readFileSync(
    resolve(__dirname, './__tests__/schemas/test.graphql'),
  ).toString(),
  adapter: IAdaptersTypes.hasura,
  debug: true,
  database: {
    type: DatabaseTypes.postgres,
    connection: seq,
    syncOptions: {
      force: true,
      schema: 'public',
    },
  },
})

parser.run().catch(err => {
  console.error(err)
})
