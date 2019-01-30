export interface ItableDefinitions {
  [k: string]: ItableDefinition
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
  relationName: string
  relationFieldName: string
  isList: boolean
  target: string
  source: string
}
