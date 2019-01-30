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
