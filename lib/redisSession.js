(function() {
  /*
   * LemonLDAP::NG Redis session accessor for Node.js/express
   *
   * See README.md for license and copyright
   */
  var RedisSession, redis;

  redis = require('redis');

  RedisSession = class RedisSession {
    constructor(logger, opts) {
      var port;
      this.logger = logger;
      port = 0;
      if (!opts.server) {
        Error("server is required for Redis backend");
      }
      if (opts.server.match(/(.*?):(\d+)/)) {
        opts.server = RegExp.$1;
        port = RegExp.$2;
      } else {
        port = 6379;
      }
      this.client = redis.createClient(port, opts.server);
    }

    get(id) {
      var q, self;
      self = this;
      console.log('GET', id);
      q = new Promise(function(resolve, reject) {
        return self.client.get(id, function(error, buffer) {
          var e, tmp;
          if (error) {
            return reject(error);
          } else {
            try {
              tmp = JSON.parse(buffer);
              return resolve(tmp);
            } catch (error1) {
              e = error1;
              console.log(e);
              return reject(e);
            }
          }
        });
      });
      return q;
    }

    update(id, data) {}

  };

  module.exports = RedisSession;

}).call(this);
