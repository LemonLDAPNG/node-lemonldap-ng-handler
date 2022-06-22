import { LLNG_Conf, LLNG_Logger } from '@LLNG/types'
import Std from './Std'
import uWsgi from './uWsgi'

const knownLoggers = {
  // @ts-ignore: methods are defined
  std: Std,
  // @ts-ignore: methods are defined
  uwsgi: uWsgi
}

export default (conf: LLNG_Conf, userLogger: boolean) => {
  const wantedLogger: string = (userLogger && conf.userLogger
    ? conf.userLogger
    : conf.logger
  )
    .replace(/^Lemonldap::NG::Common::Logger::/i, '')
    .toLowerCase()
  // @ts-ignore: this test avoids error
  if (knownLoggers[wantedLogger]) {
    return Promise.resolve(
      //@ts-ignore
      new knownLoggers[wantedLogger](conf.logLevel || 'notice', userLogger)
    )
  } else {
    return new Promise((resolve, reject) => {
      import(`@LLNG/logger-${wantedLogger}`)
        .then(mod => {
          resolve(new mod(conf.logLevel, userLogger))
        })
        .catch(e => reject(e))
    })
  }
}
