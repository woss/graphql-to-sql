/**
 * this is helper for cli running, dev purposes only
 */

require('dotenv').config()

import {resolve} from 'path'
import {DatabaseTypes, IAdaptersTypes} from './interfaces'
import {readFileSync} from 'fs'
import sequelize from 'sequelize'
import {DefaultParser} from '.'

const {
  PG_DB,
  PG_USER,
  PG_PASSWORD,
  PG_HOST,
  PG_PORT,
  PG_PORT_FORWARDED,
  PG_LOGGING,
} = process.env

if (!PG_DB || !PG_USER || !PG_PASSWORD || !PG_HOST || !PG_PORT) {
  throw new Error('Please set up the env variables')
}
console.log(
  PG_DB,
  PG_USER,
  PG_PASSWORD,
  PG_HOST,
  PG_PORT,
  PG_PORT_FORWARDED,
  PG_LOGGING,
)
const schema = 'public'

const seq = new sequelize(PG_DB, PG_USER, PG_PASSWORD, {
  host: PG_HOST,
  port: parseInt(PG_PORT_FORWARDED || PG_PORT, 10),
  logging: true,
  dialect: 'postgres',
  define: {
    timestamps: false,
    underscored: true,
  },
})

// seq.createSchema(schema, {})
const schemaString = readFileSync(
  resolve(__dirname, '../datamodel.graphql'),
).toString()

const parser = new DefaultParser({
  schema: schemaString,
  adapters: [IAdaptersTypes.postgraphile],
  debug: true,
  database: {
    type: DatabaseTypes.postgres,
    connection: seq,
    syncOptions: {
      schema,
      force: true,
    },
  },
})

parser.run().catch(err => {
  console.error(err)
})
