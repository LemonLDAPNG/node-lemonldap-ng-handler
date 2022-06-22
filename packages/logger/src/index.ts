import { LLNG_Conf, LLNG_Logger } from '@lemonldap-ng/types'
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
    ? conf.logger
    : 'std'
  )
    .replace(/^Lemonldap::NG::Common::Logger::/i, '')
    .toLowerCase()

  // @ts-ignore: this test avoids error
  if (knownLoggers[wantedLogger]) {
    return Promise.resolve(
      //@ts-ignore
      new knownLoggers[wantedLogger](
        conf.logLevel || 'notice',
        userLogger,
        conf
      )
    )
  } else {
    return new Promise((resolve, reject) => {
      import(`@lemonldap-ng/logger-${wantedLogger}`)
        .then(mod => {
          const cl = mod.default
          resolve(new cl(conf.logLevel, userLogger, conf))
        })
        .catch(e => reject(e))
    })
  }
}
