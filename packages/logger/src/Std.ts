import { LLNG_Logger, LogLevel } from '@LLNG/types'

// @ts-ignore: tsc doesn't see how we imlement logger methods
class LoggerStd implements LLNG_Logger {
  constructor (logLevel: LogLevel, userLogger: boolean) {
    let stop: boolean = false
    const methods: LogLevel[] = ['error', 'warn', 'notice', 'info', 'debug']
    methods.forEach((level: LogLevel) => {
      const m = level === 'notice' ? 'warn' : level === 'info' ? 'log' : level
      // @ts-ignore: this implements missing methods
      this[level] = stop ? () => {} : console[m]
      if (level === logLevel) stop = true
    })
  }
}

export default LoggerStd
