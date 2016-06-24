
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
    var datas;
    datas = {};
    return new Promise(function(resolve, reject) {
      return exports.fs.readFile(exports.directory + "/" + id, function(err, data) {
        if (err) {
          console.log(err);
          return resolve(false);
        } else {
          return resolve(data);
        }
      });
    });
  };

  exports.update = function(id, data) {
    return new Promise(function(resolve, reject) {
      return exports.fs.writeFile(exports.directory + "/" + id, JSON.stringify(data, function(err, data) {
        if (err) {
          return reject(err);
        } else {
          return resolve(data);
        }
      }));
    });
  };

}).call(this);
