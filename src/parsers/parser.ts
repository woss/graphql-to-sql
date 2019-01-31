import {IParserConfig} from '../interfaces'

export default abstract class Parser {
  abstract configure(config: IParserConfig)
  abstract parse()
}
