import {ItableDefinitions} from '../interfaces'
import Adapter from './adapter'

export default class HasuraAdapter extends Adapter {
  cleanRelations(tables: ItableDefinitions) {
    Object.keys(tables).map(key => {
      const sourceTable = tables[key]
      const {relations: relationsA, name} = sourceTable

      Object.keys(relationsA).map(key => {
        const {isList, source, target} = relationsA[key]
        if (!isList) {
          const tableIsTargetRelation = Object.keys(tables).map(key => {
            const relationTable = tables[key]
            const {relations: relationsB, name} = relationTable
            return Object.keys(relationsB).map(key => {
              const r = relationsB[key]
              const {target: targetB} = relationsA[key]

              return source === targetB
            })
          })
          if (source === '') {
            console.log('s')
          }
        }
      })
      // find 1:n relations and remove them
      // if (fieldA.relationName !== null && fieldA.relatedField === null) {
      // this is 1:n relationship
      /**
           ```gql
              type A {
                id: ID! 
              }
              type B {
                id: ID!
                a: A @relation(name: "AinB") 
              }
           ```
           */
      // }

      // this is 1:n relationship
      /**
           ```gql
              type A {
                id: ID!
                b: A @relation(name: "AinB")
                OR
                b: A @relation(name: "AinBBBBBBBBBBBBBB")
              }
              type B {
                id: ID!
                a: A @relation(name: "AinB")
              }
           ```
           */
      // possoble a link table unless a person connected the fields with different relationnames
    })
  }
  updateRelationName() {}
}
