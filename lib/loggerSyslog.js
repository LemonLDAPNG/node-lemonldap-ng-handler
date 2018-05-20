(function() {
  /*
   *
   * LemonLDAP::NG syslog logger
   *
   */
  var Syslog, f, o, syslog;

  syslog = require('modern-syslog');

  o = syslog.option;

  f = syslog.facility;

  Syslog = class Syslog {
    constructor(conf, type) {
      var fac, i, j, l, len, p, ref;
      if (type) {
        fac = conf.userSyslogFacility || 'auth';
      } else {
        fac = conf.syslogFacility || 'daemon';
      }
      fac = f[`LOG_${fac.toUpperCase()}`];
      syslog.open('LLNG', o.LOG_CONS + o.LOG_PID + o.LOG_NDELAY, fac);
      i = 1;
      ref = ['error', 'warn', 'notice', 'info', 'debug'];
      for (j = 0, len = ref.length; j < len; j++) {
        l = ref[j];
        if (i) {
          p = l === 'warn' ? 'warning' : l === 'error' ? 'err' : l;
          p = syslog.level[`LOG_${p.toUpperCase()}`] + fac;
          this[l] = function(txt) {
            return syslog.log(p, txt);
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
