import { LLNG_Conf, LLNG_Logger, LogLevel } from '@LLNG/types'
// @ts-ignore
import syslog from 'modern-syslog'

// @ts-ignore: tsc doesn't see how we imlement logger methods
class LoggerSyslog implements LLNG_Logger {
  constructor (logLevel: LogLevel, userLogger: boolean, conf: LLNG_Conf) {
    const facility =
      'LOG_' +
      (userLogger
        ? conf.userSyslogFacility || 'auth'
        : conf.syslogFacility || 'daemon'
      ).toUpperCase()
    syslog.open(
      'LLNG',
      syslog.option.LOG_CONS,
      syslog.option.LOG_PID,
      syslog.option.LOG_NDELAY,
      facility
    )
    const levels = ['error', 'warn', 'notice', 'info', 'debug']
    let stop = false
    levels.forEach(level => {
      const syslogPriority =
        'LOG_' +
        (level == 'warn'
          ? 'warning'
          : level == 'error'
          ? 'err'
          : level
        ).toUpperCase()
      // @ts-ignore
      this[level] = stop
        ? () => {}
        : (txt: string) => {
            syslog.log(syslogPriority, txt)
          }
      if (level === logLevel) stop = true
    })
  }
}

export default LoggerSyslog
