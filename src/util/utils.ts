import {IGQLField} from 'prisma-datamodel'

export const generateTableName = (field: string | IGQLField): string => {
  if (typeof field === 'string') {
    return field.toLowerCase()
  }
  const {type, name} = field
  if (typeof type !== 'string') {
    return type.name.toLowerCase()
  } else {
    return name.toLowerCase()
  }
}
export const removeIndexFromArray = (idx: number, array: any[]): number[] => {
  var i = array.indexOf(idx)
  if (i > -1) {
    array.splice(i, 1)
  }
  return array
}
