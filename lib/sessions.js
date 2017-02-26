
/*
 *
 */

(function() {
  var backend, localCache, sessions;

  localCache = {};

  backend = {};

  sessions = (function() {
    var newCache;

    function sessions(type, opts) {
      var err, error, m;
      if (opts == null) {
        opts = {};
      }
      try {
        m = require("./" + (type.toLowerCase()) + "Session");
        backend = new m(opts);
        newCache(opts);
      } catch (error) {
        err = error;
        console.log("Unable to load " + type + " session backend: " + err);
        process.exit(1);
      }
    }

    sessions.prototype.get = function(id) {
      return new Promise(function(resolve, reject) {
        return localCache.get(id).then(function(lsession) {
          if (lsession) {
            return resolve(lsession);
          } else {
            return backend.get(id).then(function(session) {
              console.log("Download session " + id);
              localCache.set(id, session);
              return resolve(session);
            })["catch"](function() {
              return reject(null);
            });
          }
        })["catch"](function(e) {
          console.log("localCache error", e);
          return reject(e);
        });
      });
    };

    sessions.prototype.update = function(id, data) {
      return new Promise(function(resolve, reject) {
        return Promise.all([backend(id, data), localCache.set(id, data)]).then(function(v) {
          return resolve(v[0]);
        })["catch"](function() {
          console.log("Session update error");
          return reject(null);
        });
      });
    };

    newCache = function(args) {
      var fileCache;
      if (args == null) {
        args = {};
      }
      fileCache = require('file-cache-simple');
      args.cacheExpire = 600000;
      args.cacheDir || (args.cacheDir = '/tmp/llng');
      args.prefix = 'llng';
      return localCache = new fileCache(args);
    };

    return sessions;

  })();

  module.exports = sessions;

}).call(this);
