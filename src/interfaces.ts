import {SyncOptions, Options} from 'sequelize'

export enum IAdaptersTypes {
  hasura = 'hasura',
  postgraphile = 'postgraphile',
}

export enum ParserTypes {
  prisma = 'prisma',
}

export enum DatabaseTypes {
  postgres = 'postgres',
}

export interface ItableDefinition {
  name: string
  columns: {}
  relations?: ITableRelation[]
}

export interface ITableRelation {
  name: string
  fieldName: string
  isList: boolean
  target: string
  source: string
}

export interface IParserConfig {
  schema: string
  adapters?: IAdaptersTypes[]
  debug?: boolean
  database: {
    type: DatabaseTypes
    connectionParams?: Options
    syncOptions: SyncOptions
  }
}

export interface KeyValue {
  [k: string]: string
}
