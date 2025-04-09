const PerlDBI = require('perl-dbi')
const CDBI = require('..')
const fs = require('fs')

const db = `${__dirname}/db.sqlite`
const dbiChain = `dbi:SQLite:dbname=${db}`

const clean = () => {
  try {
    fs.unlinkSync(db)
  } catch (e) {console.debug(e)}
}

let cdbi

beforeAll(async () => {
  clean()

  const conn = PerlDBI({
    dbiChain
  })
  await conn.schema.createTable('lmconfig', function (table) {
    table.integer('cfgNum')
    table.string('field')
    table.string('value')
  })
  conn.destroy()
  cdbi = new CDBI({ dbiChain })
})

afterAll(() => {
  cdbi.destroy()
  clean()
})

test('store new conf', done => {
  cdbi.store({ cfgNum: 1, f1: 'field 1' }).then(res => {
    expect(res).toBeTrue
    done()
  })
})

test('read new conf', done => {
  cdbi
    .load(1)
    .then(res => {
      expect(res.f1).toEqual('field 1')
      done()
    })
    .catch(e => {
      console.error(e)
    })
})

test('store updated conf', done => {
  cdbi.store({ cfgNum: 1, f1: 'field 2' }).then(res => {
    expect(res).toBeTrue
    done()
  })
})

test('read updated conf', done => {
  cdbi
    .load(1)
    .then(res => {
      expect(res.f1).toEqual('field 2')
      done()
    })
    .catch(e => {
      console.error(e)
    })
})
