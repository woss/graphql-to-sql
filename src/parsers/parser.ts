import {IParserConfig} from '../interfaces'

export default abstract class Parser {
  /**
   * Configure the parser
   * @param config IParserConfig
   */
  abstract configure(config: IParserConfig): void
  /**
   * Where magic happens
   */
  abstract run(): void
}
