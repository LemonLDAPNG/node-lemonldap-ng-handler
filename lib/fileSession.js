
/*
 * LemonLDAP::NG file session accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var session;

  session = (function() {
    session.prototype.fs = require('fs');

    session.prototype.directory = '/tmp';

    function session(opts) {
      var state;
      if (opts.Directory) {
        this.directory = opts.Directory;
      }
      state = this.fs.statSync(this.directory);
      if (!state.isDirectory()) {
        console.log(this.directory + " isn't usable to manage File sessions");
        process.exit(1);
      }
      this;
    }

    session.prototype.get = function(id) {
      var datas;
      datas = {};
      return new Promise(function(resolve, reject) {
        return this.fs.readFile(this.directory + "/" + id, 'utf-8', function(err, data) {
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

    session.prototype.update = function(id, data) {
      return new Promise(function(resolve, reject) {
        return this.fs.writeFile(this.directory + "/" + id, 'utf-8', JSON.stringify(data, function(err, data) {
          if (err) {
            return reject(err);
          } else {
            return resolve(data);
          }
        }));
      });
    };

    return session;

  })();

  module.exports = session;

}).call(this);
