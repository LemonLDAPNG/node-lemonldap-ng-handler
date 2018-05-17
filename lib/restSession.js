(function() {
  /*
   * LemonLDAP::NG REST session accessor for Node.js/express
   *
   * See README.md for license and copyright
   */
  var RestSession;

  RestSession = class RestSession {
    constructor(logger, args) {
      this.logger = logger;
      this.args = args;
      if (!this.args.baseUrl) {
        Error("baseUrl parameter is required for REST sessions");
      }
      if (!this.args.baseUrl.match(/(https?):\/\/([^\/:]+)(?::(\d+))?(.*)/)) {
        Error(`Bad URL ${this.args.baseUrl}`);
      }
      this.host = RegExp.$2;
      this.port = RegExp.$3 || (RegExp.$1 === 'https' ? 443 : 80);
      this.path = RegExp.$4 || '/';
      this.http = require(RegExp.$1);
      if (!this.path.match(/\/$/)) {
        this.path += '/';
      }
    }

    get(id) {
      var opt, self;
      self = this;
      opt = {
        host: this.host,
        port: this.port,
        path: this.path + id
      };
      if (this.args.user && this.args.password) {
        opt.headers = {
          Authorization: "Basic " + Buffer.from(`${this.args.user}:${this.args.password}`).toString('base64')
        };
      }
      return new Promise(function(resolve, reject) {
        var req;
        self.logger.debug(`Trying to get ${id} from remote ${opt.host}`);
        req = self.http.request(opt, function(resp) {
          var str;
          str = '';
          resp.on('data', function(chunk) {
            return str += chunk;
          });
          return resp.on('end', function() {
            var err, tmp;
            if (str) {
              try {
                tmp = JSON.parse(str);
                return resolve(tmp);
              } catch (error) {
                err = error;
                return reject(`Error when parsing REST session (${err})`);
              }
            } else {
              self.logger.info(err);
              return resolve(false);
            }
          });
        });
        req.on('error', function(e) {
          return reject(`Unable to query session server: ${e.message}`);
        });
        return req.end();
      });
    }

    update(id, data) {
      return new Promise(function(resolve, reject) {
        return Error('TODO');
      });
    }

  };

  module.exports = RestSession;

}).call(this);
