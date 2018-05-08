(function() {
  /*
   *
   * LemonLDAP::NG standard logger (log to console)
   *
   */
  var LoggerStd;

  LoggerStd = class LoggerStd {
    constructor(conf) {
      var i, j, l, len, ref;
      i = 1;
      ref = ['error', 'warn', 'notice', 'info', 'debug'];
      for (j = 0, len = ref.length; j < len; j++) {
        l = ref[j];
        if (i) {
          this[l] = function(txt) {
            return console.log(`[${l}]`, txt);
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

  module.exports = LoggerStd;

}).call(this);
