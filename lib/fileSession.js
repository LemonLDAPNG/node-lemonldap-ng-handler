
/*
 * LemonLDAP::NG file session accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  exports.fs = require('fs');

  exports.directory = '/tmp';

  exports.init = function(opts) {
    if (opts == null) {
      opts = {};
    }
    if (opts.Directory) {
      exports.directory = opts.Directory;
    }
    return exports;
  };

  exports.get = function(id) {
    var datas, error, error1;
    datas = {};
    try {
      return JSON.parse(this.fs.readFileSync(this.directory + "/" + id));
    } catch (error1) {
      error = error1;
      console.log(error);
      return null;
    }
  };

  exports.update = function(id, data) {
    var error, error1;
    try {
      return this.fs.writeFileSync(this.directory + "/" + id, JSON.stringify(data));
    } catch (error1) {
      error = error1;
      console.log(error);
      return 0;
    }
  };

}).call(this);
