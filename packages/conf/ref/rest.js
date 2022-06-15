(function() {
  /*
   * LemonLDAP::NG REST configuration accessor for Node.js
   *
   * See README.md for license and copyright
   */
  var restConf;

  restConf = class restConf {
    constructor(args) {
      this.args = args;
      if (!this.args.baseUrl) {
        Error("baseUrl parameter is required in REST configuration type");
      }
      if (!this.args.baseUrl.match(/(https?):\/\/([^\/:]+)(?::(\d+))?(.*)/)) {
        Error(`Bad URL ${this.args.baseUrl}`);
      }
      this.host = RegExp.$2;
      this.port = RegExp.$3 || (RegExp.$1 === 'https' ? 443 : 80);
      this.path = RegExp.$4 || '/';
      this.http = require(RegExp.$1);
    }

    available() {
      var d;
      d = new Promise(function(resolve, reject) {
        return reject('Not implemented for now');
      });
      return d;
    }

    lastCfg() {
      var d, self;
      self = this;
      d = new Promise(function(resolve, reject) {
        return self.get('latest').then(function(res) {
          return resolve(res.cfgNum);
        }).catch(function(e) {
          return reject(e);
        });
      });
      return d;
    }

    load(cfgNum, fields) {
      var d, self;
      self = this;
      d = new Promise(function(resolve, reject) {
        return self.get(`${cfgNum}?full=1`).then(function(res) {
          return resolve(res);
        }).catch(function(e) {
          return reject(e);
        });
      });
      return d;
    }

    get(path) {
      var d, opt, self;
      self = this;
      opt = {
        host: this.host,
        port: this.port,
        path: this.path + path
      };
      if (this.args.user) {
        opt.headers = {
          Authorization: "Basic " + Buffer.from(`${this.args.user}:${this.args.password}`).toString('base64')
        };
      }
      d = new Promise(function(resolve, reject) {
        var req;
        req = self.http.request(opt, function(resp) {
          var str;
          str = '';
          resp.on('data', function(chunk) {
            return str += chunk;
          });
          return resp.on('end', function() {
            var err, json, res;
            if (str) {
              res = '';
              try {
                json = JSON.parse(str);
                return resolve(json);
              } catch (error) {
                err = error;
                return reject(`JSON parsing error: ${err}`);
              }
            } else {
              return reject("No response received");
            }
          });
        });
        req.on('error', function(e) {
          return reject(`Enable to query configuration server: ${e.message}`);
        });
        return req.end();
      });
      return d;
    }

  };

  module.exports = restConf;

}).call(this);
