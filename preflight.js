#!/usr/bin/env node
console.log('PREFLIGHT CHECK')
var fs = require('fs')
var path = require('path')

try {
  var dotenv = require('dotenv')
  var parsedEnvFile = dotenv.config().parsed
  var sampleFilePath = path.resolve(__dirname, 'sample.env')
  var sampleFileContent = fs.readFileSync(sampleFilePath, 'utf8')
  var parsedSampleFile = dotenv.parse(sampleFileContent)
  var errors = []

  Object.keys(parsedSampleFile).forEach(key => {
    if (!parsedEnvFile.hasOwnProperty(key)) errors.push(key)
  })

  if (!!errors) {
    console.log('PREFLIGHT CHECK PASSED')
  } else {
    console.log('PREFLIGHT CHECK ERRORED')
    errors.forEach(key => {
      console.error('Please add %s to your env', key)
    })
  }
} catch (error) {
  console.error('There was an error while preflight check')
  console.error(error.message)
}
