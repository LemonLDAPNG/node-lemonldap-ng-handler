
/*
 * LemonLDAP::NG crypto module for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  exports.init = function(key, mode) {
    this.key = key;
    this.mode = mode;
    return exports;
  };

  exports.encrypt = function(s) {
    console.log('TODO');
    return s;
  };

  exports.decrypt = function(s) {
    console.log('TODO');
    return s;
  };

}).call(this);
