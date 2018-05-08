(function() {
  /*
   *
   * LemonLDAP::NG syslog logger (log to console)
   *
   */
  var Facility, Severity, Syslog;

  Severity = {
    error: 3,
    warn: 4,
    notice: 5,
    info: 6,
    debug: 7
  };

  Facility = {
    kernel: 0,
    user: 1,
    system: 3,
    daemon: 3,
    auth: 4,
    syslog: 5,
    lpr: 6,
    news: 7,
    uucp: 8,
    cron: 9,
    authpriv: 10,
    ftp: 11,
    audit: 13,
    alert: 14,
    local0: 16,
    local1: 17,
    local2: 18,
    local3: 19,
    local4: 20,
    local5: 21,
    local6: 22,
    local7: 23
  };

  Syslog = class Syslog {
    constructor(conf, type) {
      var cli, fac, i, j, l, len, opt, ref, syslog;
      syslog = require('syslog-client');
      cli = syslog.createClient("localhost");
      if (type) {
        fac = Facility[conf.userSyslogFacility] || Facility.auth;
      } else {
        fac = Facility[conf.syslogFacility] || Facility.daemon;
      }
      ref = ['error', 'warn', 'notice', 'info', 'debug'];
      for (j = 0, len = ref.length; j < len; j++) {
        l = ref[j];
        opt = {
          facility: fac,
          severity: Severity[l]
        };
        if (i) {
          this[l] = function(txt) {
            return cli.log(txt, opt);
          };
        } else {
          this[l] = function(txt) {};
        }
        if (conf.logLevel === l) {
          i = 0;
        }
      }
    }

  };

  module.exports = Syslog;

}).call(this);
