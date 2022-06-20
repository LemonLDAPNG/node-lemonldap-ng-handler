const { MockServer } = require('jest-mock-server')
const sessionREST = require('..')

const server = new MockServer()
const id = 'aaaaaaaaaaaaaa'

beforeAll(() => server.start())
afterAll(() => server.stop())
beforeEach(() => server.reset())

test('able to get session', done => {
  const route = server.get(/^.*$/).mockImplementationOnce(ctx => {
    expect(ctx.originalUrl).toEqual(`/${id}`)
    ctx.status = 200
    ctx.body = `{"_session_id":"${id}","f1":"field 1"}`
  })

  const baseUrl = server.getURL().href
  const sessionConn = new sessionREST({ baseUrl })
  sessionConn
    .get(id)
    .then(session => {
      expect(session.f1).toEqual('field 1')
      done()
    })
    .catch(e => {
      throw new Error(e)
    })
})
