
/*
 * LemonLDAP::NG file session accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  exports.fs = require('fs');

  exports.directory = '/tmp';

  exports.init = function(opts) {
    var state;
    if (opts == null) {
      opts = {};
    }
    if (opts.Directory) {
      exports.directory = opts.Directory;
    }
    state = exports.fs.statSync(exports.directory);
    if (!state.isDirectory()) {
      console.log(exports.directory + " isn't usable to manage File sessions");
      process.exit(1);
    }
    return exports;
  };

  exports.get = function(id) {
    var datas;
    datas = {};
    return new Promise(function(resolve, reject) {
      return exports.fs.readFile(exports.directory + "/" + id, 'utf-8', function(err, data) {
        var error, tmp;
        if (err) {
          console.log(err);
          return resolve(false);
        } else {
          try {
            tmp = JSON.parse(data);
            return resolve(tmp);
          } catch (error) {
            err = error;
            console.log("Error when parsing session file (" + err + ")");
            return reject(err);
          }
        }
      });
    });
  };

  exports.update = function(id, data) {
    return new Promise(function(resolve, reject) {
      return exports.fs.writeFile(exports.directory + "/" + id, 'utf-8', JSON.stringify(data, function(err, data) {
        if (err) {
          return reject(err);
        } else {
          return resolve(data);
        }
      }));
    });
  };

}).call(this);
