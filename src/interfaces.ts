export enum IAdaptersTypes {
  hasura = 'hasura',
}

export enum ParserTypes {
  prisma = 'prisma',
}

export enum DatabaseTypes {
  postgres = 'postgres',
}

export interface ItableDefinitions {
  [tableName: string]: ItableDefinition
}

export interface ItableDefinition {
  name: string
  columns: {
    [columnName: string]: {}
  }
  relations?: {
    [columnName: string]: ITableRelation
  }
}

export interface ITableRelation {
  name: string
  fieldName: string
  isList: boolean
  target: string
  source: string
}

export interface IParserConfig {
  schemaString: string
  adapters: IAdaptersTypes[]
  databaseType: DatabaseTypes
}
