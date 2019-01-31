import {IAdaptersTypes} from '../interfaces'
import HasuraAdapter from './hasura'

export default abstract class Adapters {
  public static create(parserType: IAdaptersTypes = IAdaptersTypes.hasura) {
    switch (parserType) {
      default:
      case IAdaptersTypes.hasura:
        return new HasuraAdapter()
    }
  }
}
