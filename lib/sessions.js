
/*
 *
 */

(function() {
  var localCache, newCache;

  localCache = null;

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

  exports.init = function(type, opts) {
    var err, error;
    if (opts == null) {
      opts = {};
    }
    try {
      exports.backend = require("./" + (type.toLowerCase()) + "Session");
      exports.backend.init(opts);
      newCache(opts);
    } catch (error) {
      err = error;
      console.log("Unable to load " + type + " session backend: " + err);
      process.exit(1);
    }
    return exports;
  };

  exports.get = function(id) {
    return new Promise(function(resolve, reject) {
      var err, error;
      try {
        return localCache.get(id).then(function(lsession) {
          if (lsession != null) {
            return resolve(lsession);
          } else {
            return exports.backend.get(id).then(function(session) {
              console.log("Download session " + id);
              localCache.set(id, session);
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

  exports.update = function(id, data) {
    return new Promise(function(resolve, reject) {
      return Promise.all([exports.backend(id, data), localCache.set(id, data)]).then(function(v) {
        return resolve(v[0]);
      }, function(err) {
        console.log("Session update", err);
        return reject(err);
      });
    });
  };

}).call(this);
