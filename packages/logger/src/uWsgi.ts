import { LLNG_Logger, LogLevel } from "@lemonldap-ng/types";

// @ts-ignore: tsc doesn't see how we imlement logger methods
class uWsgiLogger implements LLNG_Logger {
  // eslint-disable-next-line no-unused-vars
  constructor(logLevel: LogLevel, userLogger: boolean) {
    let stop: boolean = false;
    const methods: LogLevel[] = ["error", "warn", "notice", "info", "debug"];
    methods.forEach((level: LogLevel) => {
      // @ts-ignore: this implements missing methods
      this[level] = stop
        ? () => {}
        : (txt: string) => {
            // @ts-expect-error: uwsgi is defined by uWsgi v8 plugin
            uwsgi.log(`[${level}] ${txt}`);
          };
      if (level === logLevel) stop = true;
    });
  }
}

export default uWsgiLogger;
