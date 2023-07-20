const { MockServer } = require('jest-mock-server')
const REST = require('..')

const server = new MockServer()

beforeAll(() => server.start())
afterAll(() => server.stop())
beforeEach(() => server.reset())

test('lastCfg', done => {
  const route = server.get('/latest').mockImplementationOnce(ctx => {
    ctx.status = 200
    ctx.body = '{"cfgNum":1,"f1":"field 1"}'
  })
  const baseUrl = server.getURL().href
  const restConf = new REST({ baseUrl })
  restConf.lastCfg().then(res => {
    expect(res).toEqual(1)
    done()
  })
})

test('load', done => {
  const route = server.get(/^.*$/).mockImplementationOnce(ctx => {
    expect(ctx.originalUrl).toEqual('/1?full=1')
    ctx.status = 200
    ctx.body = '{"cfgNum":1,"f1":"field 1"}'
  })
  const baseUrl = server.getURL().href
  const restConf = new REST({ baseUrl })
  restConf.load(1).then(res => {
    expect(res).toEqual({ cfgNum: 1, f1: 'field 1' })
    done()
  })
})

test('authentified load', done => {
  const route = server.get(/^.*$/).mockImplementationOnce(ctx => {
    expect(ctx.request.header.authorization).toEqual('Basic Zm9vOmJhcg==')
    ctx.status = 200
    ctx.body = '{"cfgNum":1,"f1":"field 2"}'
  })
  const baseUrl = server.getURL().href
  const restConf = new REST({
    baseUrl,
    user: 'foo',
    password: 'bar'
  })
  restConf.load(1).then(res => {
    expect(res).toEqual({ cfgNum: 1, f1: 'field 2' })
    done()
  })
})

test('required fields', () => {
  expect(() => {
    const r = new REST({})
  }).toThrow(/required/)
  expect(() => {
    const r = new REST({ baseUrl: 'foo' })
  }).toThrow(/Bad URL/)
  expect(() => {
    const r = new REST({
      baseUrl: 'https://foo',
      user: 'foo'
    })
  }).toThrow(/password required/)
})
