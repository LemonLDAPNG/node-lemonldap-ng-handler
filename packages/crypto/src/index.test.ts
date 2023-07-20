const Crypto = require('..')
const crypto = new Crypto('qwertyui')
const data = require('./__testData__/cr.json')

test('Able to decrypt its encrypted data', () => {
  Object.keys(data).forEach(k => {
    expect(crypto.decrypt(crypto.encrypt(k))).toEqual(k)
  })
})

test('Able to encode like Perl libraries', () => {
  Object.keys(data).forEach(k => {
    expect(crypto.decrypt(data[k])).toEqual(k)
  })
})
