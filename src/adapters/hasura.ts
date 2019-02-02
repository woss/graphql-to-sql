import {ItableDefinition, ITableRelation} from '../interfaces'
import Adapter from './adapter'
import axios, {AxiosInstance} from 'axios'
import {Sequelize, ModelsHashInterface} from 'sequelize'
import debug from 'debug'
import {appLog} from '..'

const {HASURA_API_ENDPOINT} = process.env

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
export default class HasuraAdapter extends Adapter {
  private config: IHasuraConfig
  private api: AxiosInstance
  private apiUrl: string
  private log: debug.IDebugger
  private error: debug.IDebugger
  private apiLog: debug.IDebugger

  configure(config: IHasuraConfig): void {
    this.config = config
    this.log = debug('GQL2SQL:adapter:hasura')
    this.apiLog = debug('GQL2SQL:adapter:hasura:api')
    this.error = debug('GQL2SQL:adapter:hasura:error')
    this.api = axios.create({
      baseURL: HASURA_API_ENDPOINT || 'https://localhost:8080',
    })

    this.apiUrl = '/v1/query'

    if (config['debug']) {
      this.api.interceptors.request.use(request => {
        this.apiLog('Request', request.url, JSON.stringify(request.data))
        return request
      })

      this.api.interceptors.response.use(response => {
        this.apiLog('Response:', response.status, JSON.stringify(response.data))
        return response
      })
    }
  }

  async apply() {
    try {
      await this.apiClearMetadata()
      await this.apiTrackTables(Object.keys(this.config.sqlResult.models))
      await this.createRelationships(this.config.sqlResult.models)
    } catch (error) {
      throw new Error(error)
    }
  }
  /**
   * Loop through set of tables to find a relation that links to yours
   * @param tableName string Target table where relation might be
   * @param sourceTableName string Soure table where relation is coming from
   */
  protected findRelation(
    tableName: string,
    sourceTableName: string,
  ): null | ITableRelation {
    const {tables} = this.config
    const baseTable = tables.find(table => table.name === tableName)
    if (baseTable) {
      return baseTable.relations.find(
        relation => relation.target === sourceTableName,
      )
    }
    return null
  }

  /**
   * Wrapper function that loops through the Sequilize models and calls API
   * Additionally tries to find connection where target is a source
   * @param models ModelsHashInterface Sequilize models
   */
  async createRelationships(models: any | ModelsHashInterface) {
    // reason why any is added is because associations are not part of the model getters, it's a field that is not relevant when workign with sequilize models, because getter for the relationship is handeled differently. This is more for orientation rather than code coverage :)
    for (const key in models) {
      const model = models[key]
      const {associations, tableName: sourceTableName} = model
      for (const k in associations) {
        const association = associations[k]

        const {
          associationType,
          as: relationName,
          target: {tableName: targetTableName},
          identifierField: column,
        } = association

        switch (associationType) {
          case 'BelongsTo':
            // if Photo belongs to a User, then User hasMany Photos
            this.log(
              'create object relationship',
              sourceTableName,
              relationName,
              column,
            )
            await this.apiCreateObjectRelationship({
              sourceTableName,
              relationName,
              column,
            })
            const columnForOpositeRelation = this.findRelation(
              targetTableName,
              sourceTableName,
            )
            if (columnForOpositeRelation) {
              this.log(
                'create object relationship in the other direction',
                targetTableName,
                column,
                columnForOpositeRelation.fieldName,
                sourceTableName,
              )
              await this.apiCreateArrayRelationship({
                sourceTableName: targetTableName,
                column,
                relationName: columnForOpositeRelation.fieldName,
                mappingTable: sourceTableName,
              })
            }

            break
          case 'BelongsToMany':
            const {
              through: {
                model: {tableName: mappingTable},
              },
            } = association
            this.log(
              'create array relationship',
              sourceTableName,
              relationName,
              column,
              mappingTable,
            )
            this.apiCreateArrayRelationship({
              sourceTableName,
              relationName,
              column,
              mappingTable,
            })
            break
          default:
            throw new Error(`Unknown associationType ${associationType}`)
        }
      }
    }
  }
  /**
   * @link https://docs.hasura.io/1.0/graphql/manual/api-reference/schema-metadata-api/relationship.html#create-object-relationship
   * @param params IAPIObjectRelationshipParams
   */
  async apiCreateObjectRelationship(params: IAPIObjectRelationshipParams) {
    const {sourceTableName, relationName, column} = params
    const request = {
      type: 'create_object_relationship',
      args: {
        table: {
          name: sourceTableName,
          schema: this.config.schema,
        },
        name: relationName,
        using: {
          foreign_key_constraint_on: column,
        },
      },
    }
    return await this.apiCallPost(request)
  }

  /**
   * @link https://docs.hasura.io/1.0/graphql/manual/api-reference/schema-metadata-api/relationship.html#create-array-relationship
   * @param params IAPIArrayRelationshipParams
   */
  async apiCreateArrayRelationship(params: IAPIArrayRelationshipParams) {
    const {sourceTableName, relationName, column, mappingTable} = params
    const request = {
      type: 'create_array_relationship',
      args: {
        table: {
          name: sourceTableName,
          schema: this.config.schema,
        },
        name: relationName,
        using: {
          foreign_key_constraint_on: {
            table: {
              name: mappingTable,
              schema: this.config.schema,
            },
            column: column,
          },
        },
      },
    }
    return await this.apiCallPost(request)
  }
  /**
   * Wrapper for the actual POST call to hasura server
   * @api
   */
  async apiCallPost(data, options?: any) {
    try {
      return await this.api.post(this.apiUrl, data, options)
    } catch (error) {
      this.error(error.message, JSON.stringify(error.response.data))
    }
  }

  /**
   * Clears all hasura metadata
   * @api
   */
  async apiClearMetadata() {
    return await this.apiCallPost({type: 'clear_metadata', args: {}})
  }

  /**
   * Track table
   * @link https://docs.hasura.io/1.0/graphql/manual/api-reference/schema-metadata-api/table-view.html#track-table
   * @api
   */
  async apiTrackTables(tableNames: string[]) {
    // bulkify the operation
    let bulkArgs: IHasuraApiRequestStructure[] = []
    tableNames.forEach(tableName => {
      bulkArgs.push({
        type: 'track_table',
        args: {
          schema: this.config.schema,
          name: tableName,
        },
      })
    })

    return await this.apiCallPost(
      {type: 'bulk', args: bulkArgs},
      {
        headers: {
          'X-Hasura-Role': 'admin',
        },
      },
    )
  }
}
