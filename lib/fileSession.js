
/*
 * LemonLDAP::NG file session accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var fs, session;

  fs = require('fs');

  session = (function() {
    session.prototype.directory = '/tmp';

    function session(opts) {
      var state;
      if (opts.Directory) {
        this.directory = opts.Directory;
      }
      state = fs.statSync(this.directory);
      if (!state.isDirectory()) {
        console.log(this.directory + " isn't usable to manage File sessions");
        process.exit(1);
      }
      this;
    }

    session.prototype.get = function(id) {
      var dir, q;
      dir = this.directory;
      q = new Promise(function(resolve, reject) {
        return fs.readFile(dir + "/" + id, 'utf-8', function(err, data) {
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
      return q;
    };

    session.prototype.update = function(id, data) {
      var dir;
      dir = this.directory;
      return new Promise(function(resolve, reject) {
        return fs.writeFile(dir + "/" + id, 'utf-8', JSON.stringify(data, function(err, data) {
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
