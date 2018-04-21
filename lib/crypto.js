
/*
 * LemonLDAP::NG crypto module for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var crypto;

  crypto = (function() {
    function crypto(key, mode) {
      this.key = key;
      this.mode = mode;
    }

    crypto.prototype.encrypt = function(s) {
      console.error('TODO');
      return s;
    };

    crypto.prototype.decrypt = function(s) {
      console.error('TODO');
      return s;
    };

    return crypto;

  })();

  module.exports = crypto;

}).call(this);
