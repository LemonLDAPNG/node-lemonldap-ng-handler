const SafeLib = require('..')
const Crypto = require('@lemonldap-ng/crypto')

let safeLib
let cipher

beforeAll(() => {
  cipher = new Crypto('aaa')
  safeLib = new SafeLib({ cipher })
})

test('basic()', () => {
  expect(safeLib.basic('é', 'à')).toEqual('Basic 6Trg')
})

test('checkDate', () => {
  expect(safeLib.checkDate(1, 99999999999999)).toBeTruthy()
  expect(safeLib.checkDate(1, 20171231140000)).toBeFalsy()
})

test('isInNet6', () => {
  expect(safeLib.isInNet6('2018::1', '2000::0/11')).toBeTruthy()
  expect(safeLib.isInNet6('2018::1', '2000::0/12')).toBeFalsy()
})

test('encrypt and decrypt', () => {
  expect(cipher.decrypt(safeLib.encrypt('azertyui'))).toEqual('azertyui')
})

test('token', () => {
  const res = cipher.decrypt(safeLib.token('a', 'b')).split(':')
  expect(res[1]).toEqual('a')
  expect(res[2]).toEqual('b')
  expect(res.length).toEqual(3)
})

test('encode_base64', () => {
  expect(safeLib.encode_base64('aaa')).toEqual('YWFh')
})

test('iso/utf8', () => {
  expect(safeLib.iso2unicode(safeLib.unicode2iso('é:à'))).toEqual('é:à')
})
