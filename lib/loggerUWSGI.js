(function() {
  /*
   *
   * LemonLDAP::NG uWSGI logger (usable only under uwsgi V8 plugin)
   *
   */
  var UwsgiLog;

  UwsgiLog = class UwsgiLog {
    constructor(conf, type) {
      var i, j, l, len, ref;
      i = 1;
      ref = ['error', 'warn', 'notice', 'info', 'debug'];
      for (j = 0, len = ref.length; j < len; j++) {
        l = ref[j];
        if (i) {
          this[l] = function(txt) {
            return uwsgi.log(`[${l}]`, txt);
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

  module.exports = UwsgiLog;

}).call(this);
