# Title

https://stackoverflow.com/questions/12505158/generating-a-uuid-in-postgres-for-insert-statement

https://www.postgresql.org/docs/current/uuid-ossp.html
generate uuid

```sql
SELECT uuid_in(overlay(overlay(md5(random()::text || ':' || clock_timestamp()::text) placing '4' from 13) placing to_hex(floor(random()*(11-8+1) + 8)::int)::text from 17)::cstring);

```

## Debug && Development

For convenience `.vscode` folder is provided for easier debugging and development.

This will run the `./src/run.ts` which is the way how I test the module. THis should **not** be imported or used directly, it is a dev/test file.

```sh
yarn
yarn start
```

Open VSCode and hit F5 to attach to the current running process. Enjoy debugging. :)

## Logging

[Debug](https://npmjs.org/package/debug) npm package is used to do the logging.

Each of the Adapters and Parsers has it's own logger for convenience in debugging.
To activate ALL logger set the environmental variable to `DEBUG=GQL2SQL*` and be amazed amount of logs you get :)

You can specify to log only parsers like `DEBUG=GQL2SQL:parser*` or just prisma parser like `DEBUG=GQL2SQL:parser:prisma`

Adapters are similar, instead of `parser` use `adapter` like this `DEBUG=GQL2SQL:adapter*`

Some Adapters like `hasura` have multiple loggers defined, adapter related and api related. If you wish to see them all, do following `DEBUG=GQL2SQL:adapter:hasura*` or just api `DEBUG=GQL2SQL:adapter:hasura:api`

## Tasks

- [ ] `DateTime` must be correctly handled. especially `createdAt` and `updatedAt`
- [ ] `ID!` default CID, currently autoincrement

## Notes

- Prisma uses CID for ID! type, implementation here is to use autoincrement INTEGER.
- `UUID` is defaulted to `UUIDV4` and excepcts that DB supports `uuid_generate_v4()`

## On Prisma definition models

`relatedField` is populated when relation is set on both types:

Example:

```graphql
type A {
  id: ID!
  b: A @relation(name: "ABConnected")
}
type B {
  id: ID!
  a: A @relation(name: "ABConnected")
}
```

`relationName` is a name of the `@relation` directive, in above case is `ABConnected`
