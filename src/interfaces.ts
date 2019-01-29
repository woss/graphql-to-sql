export interface ItableDefinition {
  fields: {}
  relations?: {
    [x: string]: ITableRelation
  }
}
export interface ISqlTable {
  [x: string]: ItableDefinition
}

export interface ITableRelation {
  relationName: string
  relationFieldName: string
  isList: boolean
  target: string
}
