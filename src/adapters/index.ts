import {IAdaptersTypes} from '../interfaces'
import HasuraAdapter from './hasura'
import PostgraphileAdapter from './postgraphile'

export default abstract class Adapters {
  public static create(parserType: IAdaptersTypes = IAdaptersTypes.hasura) {
    switch (parserType) {
      default:
      case IAdaptersTypes.postgraphile:
        return new PostgraphileAdapter()
      case IAdaptersTypes.hasura:
        return new HasuraAdapter()
    }
  }
}
