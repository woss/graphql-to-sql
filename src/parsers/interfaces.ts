import {IAdaptersList} from '../adapters/interfaces'

export interface IParserConfig {
  schemaString: string
  adapters: IAdaptersList[]
  databaseType: DatabaseTypes
}

export enum DatabaseTypes {
  postgres = 'postgres',
}
