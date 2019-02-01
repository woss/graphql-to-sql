import {ItableDefinitions} from '../interfaces'

export default abstract class Adapter {
  abstract cleanup(tables: ItableDefinitions): void
  abstract apply(tables: ItableDefinitions): void
}
