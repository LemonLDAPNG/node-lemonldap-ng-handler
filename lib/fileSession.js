(function() {
  /*
   * LemonLDAP::NG file session accessor for Node.js/express
   *
   * See README.md for license and copyright
   */
  var fileSession, fs;

  fs = require('fs');

  fileSession = (function() {
    class fileSession {
      // Initialization:
      // verify that directory exists
      constructor(logger, opts) {
        var state;
        this.logger = logger;
        if (opts.Directory) {
          this.directory = opts.Directory;
        }
        state = fs.statSync(this.directory);
        if (!state.isDirectory()) {
          Error(`${this.directory} isn't usable to manage File sessions`);
        }
        this;
      }

      // get(): Recover session data

      // Note that it fails only on JSON parsing: if session doesn't exists, it just
      // return a false value
      get(id) {
        var dir, q, self;
        self = this;
        dir = this.directory;
        q = new Promise(function(resolve, reject) {
          return fs.readFile(`${dir}/${id}`, 'utf-8', function(err, data) {
            var tmp;
            if (err) {
              return reject(err);
            } else {
              try {
                tmp = JSON.parse(data);
                return resolve(tmp);
              } catch (error) {
                err = error;
                return reject(`Error when parsing session file (${err})`);
              }
            }
          });
        });
        return q;
      }

      update(id, data) {
        var dir;
        dir = this.directory;
        return new Promise(function(resolve, reject) {
          return fs.writeFile(`${dir}/${id}`, 'utf-8', JSON.stringify(data, function(err, data) {
            if (err) {
              return reject(err);
            } else {
              return resolve(data);
            }
          }));
        });
      }

    };

    fileSession.prototype.directory = '/tmp';

    return fileSession;

  }).call(this);

  module.exports = fileSession;

}).call(this);
