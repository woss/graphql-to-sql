#!/usr/bin/env node
require('dotenv').config()
import {resolve} from 'path'
import {DatabaseTypes, IAdaptersTypes} from './interfaces'
import {readFileSync} from 'fs'
import {DefaultParser} from '.'

var program = require('commander')
const calledPath = process.cwd()

const {
  PG_DB,
  PG_USER,
  PG_PASSWORD,
  PG_HOST,
  PG_PORT,
  PG_PORT_FORWARDED,
} = process.env

program
  .version('0.1.0')
  // .option('--adapter [type]', 'Add adapter [hasura, postgraphile]')
  .option('--port [port]', 'DB port') //optional
  .option('--host [host]', 'DB host') // optional
  .option('--dbSchema <dbSchema>', 'Database schema to use') // required
  .option('--schemaPath <path>', 'GraphQL schema path') //reqiured
  .parse(process.argv)

if (typeof program.schemaPath !== 'string') {
  console.error('no graphql schemaPath given!')
  process.exit(1)
}
if (typeof program.dbSchema !== 'string') {
  console.error('no db schema given!')
  process.exit(1)
}

const parser = new DefaultParser({
  schema: readFileSync(resolve(calledPath, program.schemaPath)).toString(),
  adapters: [IAdaptersTypes.postgraphile],
  debug: true,
  database: {
    type: DatabaseTypes.postgres,
    connectionParams: {
      username: PG_USER,
      password: PG_PASSWORD,
      database: PG_DB,
      host: program.host || PG_HOST,
      port: parseInt(program.port || PG_PORT_FORWARDED || PG_PORT, 10),
      logging: true,
      dialect: 'postgres',
      define: {
        timestamps: false,
        underscored: true,
      },
    },
    syncOptions: {
      schema: program.dbSchema,
      force: true,
    },
  },
})

parser.run().catch(err => {
  console.error(err)
})
