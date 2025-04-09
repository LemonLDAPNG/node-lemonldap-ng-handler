const syslog = require("modern-syslog");

let logSpy, openSpy;

const Logger = require("@lemonldap-ng/logger");
const conf = {
  logLevel: "notice",
  logger: "Lemonldap::NG::Common::Logger::Syslog",
};

beforeEach(() => {
  logSpy = jest.spyOn(syslog, "log");
  openSpy = jest.spyOn(syslog, "open");
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("syslog logger", () => {
  it("should apply logLevel", (done) => {
    const stdLogger = Logger(conf, false);
    stdLogger
      .then((logger) => {
        expect(openSpy).toHaveBeenCalled();
        logger.info("info");
        expect(logSpy).not.toHaveBeenCalledWith("info");
        logger.warn("warn");
        expect(logSpy).toHaveBeenCalledWith("LOG_WARNING", "warn");
        done();
      })
      .catch((e) => done(e));
  });
});
