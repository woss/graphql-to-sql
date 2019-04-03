import {ItableDefinition, ITableRelation} from '../interfaces'
import Adapter from './adapter'
import axios, {AxiosInstance} from 'axios'
import {Sequelize, ModelsHashInterface} from 'sequelize'
import debug from 'debug'
import {appLog} from '..'

const {HASURA_API_ENDPOINT, HASURA_GRAPHQL_ACCESS_KEY} = process.env

interface IAPIObjectRelationshipParams {
  sourceTableName: string
  relationName: string
  column: string
}

interface IAPIArrayRelationshipParams extends IAPIObjectRelationshipParams {
  mappingTable: string
}

interface IHasuraConfig {
  sqlResult: Sequelize
  debug?: boolean
  schema: string
  apiEndpoint?: string
  tables: ItableDefinition[]
}

interface IHasuraApiRequestStructure {
  type: string
  args: {
    [k: string]: string
  }
}
/**
 * Hasura adapter is used  to postprocess the relations to fit hasura specific
 * implementation. Api calls are as well here, prefixed with `api`
 */
export default class PostgraphileAdapter extends Adapter {
  private config: IHasuraConfig
  private api: AxiosInstance
  private apiUrl: string
  private log: debug.IDebugger
  private error: debug.IDebugger
  private apiLog: debug.IDebugger

  configure(config: IHasuraConfig): void {
    this.config = config
    this.log = debug('GQL2SQL:adapter:postgraphile')
    this.apiLog = debug('GQL2SQL:adapter:postgraphile:api')
    this.error = debug('GQL2SQL:adapter:postgraphile:error')
  }

  async apply() {
    throw new Error('not implemented')
  }
}
