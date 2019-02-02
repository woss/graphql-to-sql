import {ItableDefinition, KeyValue} from '../interfaces'
import {Sequelize} from 'sequelize'

export default abstract class Adapter {
  abstract configure(config: any): void
  abstract cleanup(): void
  abstract apply(): void
}
