import {ItableDefinition, ITableRelation} from '../interfaces'
import Adapter from './adapter'
import axios, {AxiosInstance} from 'axios'
import {Sequelize} from 'sequelize'

interface IHasuraConfig {
  sqlResult: Sequelize
  schema: string
  apiEndpoint: string
  tables: ItableDefinition[]
}

interface IHasuraApiRequestStructure {
  type: string
  args: {
    [k: string]: string
  }
}

export default class HasuraAdapter extends Adapter {
  private config: IHasuraConfig
  private api: AxiosInstance
  private apiUrl: string

  configure(config: IHasuraConfig): void {
    this.config = config
    this.api = axios.create({
      baseURL: config.apiEndpoint,
    })
    this.apiUrl = '/v1/query'

    this.api.interceptors.request.use(request => {
      console.log('Request', request.url, request.data)
      return request
    })

    this.api.interceptors.response.use(response => {
      console.log('Response:', response.status, response.data)
      return response
    })
  }

  async apply() {
    await this.clearMetadata()
    await this.trackTables(Object.keys(this.config.sqlResult.models))
    await this.createRelationships(this.config.sqlResult.models)
  }

  async callPost(data, options?: any) {
    try {
      return this.api.post(this.apiUrl, data, options)
    } catch (error) {
      console.error(error.message, JSON.stringify(error.response.data))
      return error
    }
  }

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
  async createRelationships(models: any) {
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
            await this.createObjectRelationship({
              sourceTableName,
              relationName,
              column,
            })
            const columnForOpositeRelation = this.findRelation(
              targetTableName,
              sourceTableName,
            )
            if (columnForOpositeRelation) {
              await this.createArrayRelationship({
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
            this.createArrayRelationship({
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

  async createObjectRelationship({
    sourceTableName,
    relationName,
    column,
  }: {
    sourceTableName: string
    relationName: string
    column: string
  }) {
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
    await this.callPost(request)
  }
  async createArrayRelationship({
    sourceTableName,
    relationName,
    column,
    mappingTable,
  }: {
    sourceTableName: string
    relationName: string
    column: string
    mappingTable: string
  }) {
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
    await this.callPost(request)
  }

  async clearMetadata() {
    await this.callPost({type: 'clear_metadata', args: {}})
  }

  async trackTables(tableNames: string[]) {
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

    await this.callPost(
      {type: 'bulk', args: bulkArgs},
      {
        headers: {
          'X-Hasura-Role': 'admin',
        },
      },
    )
  }

  cleanup(tables: ItableDefinition[]): ItableDefinition[] {
    return this.cleanRelations(tables)
  }
  protected cleanRelations(tables: ItableDefinition[]): ItableDefinition[] {
    const cleanedTables = []
    tables.map(sourceTable => {
      let {relations: relationsA, ...rest} = sourceTable
      let relations = []
      relationsA.forEach(firstLevelRelation => {
        const {isList, source, target} = firstLevelRelation

        if (!isList) {
          // find relation table based on target field
          const relatedTable = tables.find(t => t.name === target)
          if (relatedTable) {
            const relatedRelation = relatedTable.relations.find(
              t => t.target === source && t.source === target,
            )

            if (relatedRelation) {
              const relationAlreadyProcessed = cleanedTables.find(t => {
                if (t.name === target) {
                  return t.relations.find(r => r.name === relatedRelation.name)
                }
              })
              if (!relationAlreadyProcessed) {
                relations.push(firstLevelRelation)
              }
            } else {
              relations.push(firstLevelRelation)
            }
          }
        } else {
          relations.push(firstLevelRelation)
        }
      })
      cleanedTables.push({
        ...rest,
        relations,
      })
    })
    return cleanedTables
  }
}
