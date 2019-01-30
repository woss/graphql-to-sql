import PrismaParser from './prisma'

export enum ParserTypes {
  prisma = 'prisma',
}
export default abstract class Parsers {
  public static create(parserType: ParserTypes = ParserTypes.prisma) {
    switch (parserType) {
      default:
      case ParserTypes.prisma:
        return new PrismaParser()
    }
  }
}
