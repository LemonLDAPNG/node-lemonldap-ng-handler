(function() {
  /*
   * Session access object
   */
  var backend, localCache, sessions;

  localCache = {};

  backend = {};

  sessions = (function() {
    var newCache;

    class sessions {
      constructor(type, logger, opts = {}) {
        var err, m;
        try {
          m = require(`./${type.toLowerCase()}Session`);
          backend = new m(logger, opts);
          this.logger = logger;
          newCache(opts);
        } catch (error) {
          err = error;
          console.error(`Unable to load ${type} session backend: ${err}`);
          process.exit(1);
        }
      }

      get(id) {
        var self;
        self = this;
        return new Promise(function(resolve, reject) {
          return localCache.get(id).then(function(lsession) {
            if (lsession) {
              return resolve(lsession);
            } else {
              return backend.get(id).then(function(session) {
                self.logger.debug(`Download session ${id}`);
                localCache.set(id, session);
                return resolve(session);
              }).catch(function(e) {
                return reject(e);
              });
            }
          }).catch(function(e) {
            self.logger.error(`localCache error: ${e}`);
            return reject(e);
          });
        });
      }

      // Update session: update both central and local DB and return only central
      // DB value
      update(id, data) {
        var self;
        self = this;
        return new Promise(function(resolve, reject) {
          return Promise.all([backend(id, data), localCache.set(id, data)]).then(function(v) {
            return resolve(v[0]);
          }).catch(function(e) {
            self.logger.error(`Session update error: ${e}`);
            return reject(e);
          });
        });
      }

    };

    newCache = function(args = {}) {
      var fileCache;
      fileCache = require('file-cache-simple');
      // Cache timeout is set to 10 mn
      args.cacheExpire = 600000;
      args.cacheDir || (args.cacheDir = '/tmp/llng');
      args.prefix = 'llng';
      return localCache = new fileCache(args);
    };

    return sessions;

  }).call(this);

  module.exports = sessions;

}).call(this);
