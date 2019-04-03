import {Utils as SequlizeUtils} from 'sequelize'

export const generateTableName = (
  tableName: string,
  options = {
    pluralize: true,
    lowerCase: true,
  },
): string => {
  let name = tableName
  const {pluralize, lowerCase} = options
  if (pluralize) {
    name = SequlizeUtils.pluralize(name)
  }
  if (lowerCase) name = name.toLowerCase()
  return name
}

export const lowercaseFirstLetter = (string: string) => {
  return string.charAt(0).toLowerCase() + string.slice(1)
}

export const generateConnectingTable = (
  sourceTableName: string,
  targetTableName: string,
  options = {
    glue: '_',
    pluralize: false,
  },
): string => {
  let source = sourceTableName
  let target = targetTableName
  if (options.pluralize) {
    source = SequlizeUtils.pluralize(source)
    target = SequlizeUtils.pluralize(target)
  }
  return `${source}${options.glue}${target}`
}
export const removeIndexFromArray = (idx: number, array: any[]): number[] => {
  var i = array.indexOf(idx)
  if (i > -1) {
    array.splice(i, 1)
  }
  return array
}
