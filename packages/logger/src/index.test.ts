const Logger = require('..')
const conf = {
  logLevel: 'debug',
  logger: 'Lemonldap::NG::Common::Logger::Std'
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('Standard logger', () => {
  let spies

  beforeEach(() => {
    spies = {
      debug: jest.spyOn(console, 'debug'),
      info: jest.spyOn(console, 'log'),
      warn: jest.spyOn(console, 'warn'),
      error: jest.spyOn(console, 'error')
    }
    spies.notice = spies.warn
  })

  it('should display all levels', done => {
    const stdLogger = Logger(conf, false)
    stdLogger.then(logger => {
      const tested = ['debug', 'info', 'notice', 'error']
      tested.forEach(level => {
        logger[level](level)
        expect(spies[level]).toHaveBeenCalledWith(level)
      })
      done()
    })
  })

  it('should apply logLevel', done => {
    conf.logLevel = 'notice'
    const stdLogger = Logger(conf, false)
    stdLogger.then(logger => {
      logger.warn('warn')
      expect(spies.warn).toHaveBeenCalledWith('warn')
      logger.info('info')
      expect(spies.info).not.toHaveBeenCalledWith('info')
      done()
    })
  })
})

global.uwsgi = {
  log: console.log
}

describe('uWsgi logger as userLogger', () => {
  let uwsgiSpy

  beforeEach(() => {
     
    uwsgiSpy = jest.spyOn(uwsgi, 'log')
     
    conf.logLevel = 'notice'
    conf.userLogger = 'Lemonldap::NG::Common::Logger::UWSGI'
  })

  it('should display level in text', done => {
    const stdLogger = Logger(conf, true)
    stdLogger.then(logger => {
      logger.warn('user warn')
      expect(uwsgiSpy).toHaveBeenCalledWith('[warn] user warn')
      done()
    })
  })
})
