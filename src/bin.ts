#!/usr/bin/env node

/**
 * Module dependencies.
 */

var program = require('commander')
program
  .version('0.1.0')
  .option('--adapter [type]', 'Add adapter [hasura, postgraphile]')
  .option('--schema <path>', 'GraphQL schema path')
  .parse(process.argv)

if (typeof program.adapter !== 'string') {
  console.error('no adapter given!')
  process.exit(1)
} else if (typeof program.schema !== 'string') {
  console.error('no schema given!')
  process.exit(1)
}
console.log(program)
