import {ItableDefinition, KeyValue} from '../interfaces'
import {Sequelize} from 'sequelize'

export default abstract class Adapter {
  abstract configure(config: any): void
  abstract cleanup(tables: ItableDefinition[]): void
  abstract apply(sqlResult: Sequelize): void
}
