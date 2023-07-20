import PerlDBI from 'perl-dbi'
import session from '..'
import fs from 'fs'

const db = `${__dirname}/db.sqlite`
const dbiChain = `dbi:SQLite:dbname=${db}`

const clean = () => {
  try {
    fs.unlinkSync(db)
  } catch (e) {}
}

let sessionConn: session

beforeAll(async () => {
  clean()

  const conn = PerlDBI({
    dbiChain
  })
  // @ts-ignore
  await conn.schema.createTable('sessions', function (table) {
    table.string('id')
    table.string('a_session')
  })
  await conn
    .insert({
      id: 'aaaaaaaaaaaa',
      a_session: '{"_session_id": "aaaaaaaaaaaa", "f1": "field 1"}'
    })
    .into('sessions')
  conn.destroy()
  sessionConn = new session({
    storageModule: 'Apache::Session::Browseable::SQLite',
    storageModuleOptions: { DataSource: dbiChain }
  })
  await sessionConn.ready
})

afterAll(() => {
  clean()
  // @ts-ignore
  sessionConn.backend.db.destroy()
})

test('able to get session', done => {
  sessionConn
    .get('aaaaaaaaaaaa')
    .then(session => {
      expect(session.f1).toEqual('field 1')
      done()
    })
    .catch(e => {
      throw new Error(e)
    })
})

test('able to update session', done => {
  sessionConn
    // @ts-ignore
    .update({
      _session_id: 'aaaaaaaaaaaa',
      f1: 'field: 1',
      f2: 'field: 2'
    })
    .then(res => {
      expect(res).toBeTruthy()
      sessionConn.get('aaaaaaaaaaaa').then(session => {
        expect(session.f1).toEqual('field: 1')
        expect(session.f2).toEqual('field: 2')
        done()
      })
    })
    .catch(e => {
      throw new Error(e)
    })
})
