import {ItableDefinition, KeyValue} from '../interfaces'
import {Sequelize} from 'sequelize'

export default abstract class Adapter {
  /**
   * Configure the adapter
   * @param config Configuration
   */
  abstract configure(config: any): void
  /**
   * Where magic happens
   */
  abstract apply(): void
}
