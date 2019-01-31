import PrismaParser from './prisma'
import {ParserTypes} from '../interfaces'

export default abstract class Parsers {
  public static create(parserType: ParserTypes = ParserTypes.prisma) {
    switch (parserType) {
      default:
      case ParserTypes.prisma:
        return new PrismaParser()
    }
  }
}
