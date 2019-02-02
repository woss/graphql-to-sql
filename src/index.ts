import debug from 'debug'
export const appLog = debug('GQL2SQL')

export {default as prisma} from './parsers/prisma'
export {default as utils} from './util/utils'
export {default as adapters} from './adapters'
