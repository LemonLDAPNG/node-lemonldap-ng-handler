'use strict'
const Llngconf = require('..')
const fs = require('fs')
const path = require('path')
const ini = require('ini')

const iniSrc = path.join(__dirname, '__data__', 'lemonldap-ng.ini')
const iniTmp = path.join(__dirname, '__data__', 'lemonldap-ng.tmp.ini')

beforeAll(() => {
  let content = ini.parse(fs.readFileSync(iniSrc, 'utf-8'))
  content.configuration.dirName = path.join(__dirname, '__data__')
  fs.writeFileSync(iniTmp, ini.stringify(content))
})

afterAll(() => {
  fs.rmSync(iniTmp)
})

test('read file conf', done => {
  const confAccessor = new Llngconf({ confFile: iniTmp })
  confAccessor.ready.then(() => {
    confAccessor.getConf({}).then(conf => {
      expect(conf.cfgNum).toEqual(1)
      expect(conf.cipher.decrypt(conf.cipher.encrypt('foobar'))).toEqual(
        'foobar'
      )
      done()
    })
  })
})
