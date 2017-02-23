
/*
 *
 */

(function() {
  var sessions;

  sessions = (function() {
    function sessions(type, opts) {
      var err, error, m;
      if (opts == null) {
        opts = {};
      }
      try {
        m = require("./" + (type.toLowerCase()) + "Session");
        this.backend = new m(opts);
        this.newCache(opts);
      } catch (error) {
        err = error;
        console.log("Unable to load " + type + " session backend: " + err);
        process.exit(1);
      }
      this;
    }

    sessions.prototype.newCache = function(args) {
      var fileCache;
      if (args == null) {
        args = {};
      }
      fileCache = require('file-cache-simple');
      args.cacheExpire = 600000;
      args.cacheDir || (args.cacheDir = '/tmp/llng');
      args.prefix = 'llng';
      return this.localCache = new fileCache(args);
    };

    sessions.prototype.get = function(id) {
      return new Promise(function(resolve, reject) {
        var err, error;
        try {
          return this.localCache.get(id).then(function(lsession) {
            if (lsession != null) {
              return resolve(lsession);
            } else {
              return this.backend.get(id).then(function(session) {
                console.log("Download session " + id);
                this.localCache.set(id, session);
                return resolve(session);
              }, function(err) {
                return reject(err);
              });
            }
          });
        } catch (error) {
          err = error;
          console.log("Local cache error", err);
          return reject(err);
        }
      });
    };

    sessions.prototype.update = function(id, data) {
      return new Promise(function(resolve, reject) {
        return Promise.all([this.backend(id, data), this.localCache.set(id, data)]).then(function(v) {
          return resolve(v[0]);
        }, function(err) {
          console.log("Session update", err);
          return reject(err);
        });
      });
    };

    return sessions;

  })();

  module.exports = sessions;

}).call(this);
