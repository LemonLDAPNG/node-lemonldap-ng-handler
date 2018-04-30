
/*
 * LemonLDAP::NG REST configuration accessor for Node.js
 *
 * See README.md for license and copyright
 */

(function() {
  var restConf;

  restConf = (function() {
    function restConf(args) {
      this.args = args;
      if (!this.args.baseUrl) {
        Error("url parameter is required in REST configuration type");
      }
      if (!this.args.baseUrl.match(/(https?):\/\/([^\/:]+)(?::(\d+))?(.*)/)) {
        Error("Bad URL " + this.args.baseUrl);
      }
      this.host = RegExp.$2;
      this.port = RegExp.$3 || (RegExp.$1 === 'https' ? 443 : 80);
      this.path = RegExp.$4 || '/';
      this.http = require(RegExp.$1);
    }

    restConf.prototype.available = function() {
      var d;
      d = new Promise(function(resolve, reject) {
        return reject('Not implemented for now');
      });
      return d;
    };

    restConf.prototype.lastCfg = function() {
      var d;
      d = new Promise(function(resolve, reject) {
        return this.get('latest').then(function(res) {
          return resolve(res);
        })["catch"](function(e) {
          return reject(e);
        });
      });
      return d;
    };

    restConf.prototype.load = function(cfgNum, fields) {
      var d, self;
      self = this;
      d = new Promise(function(resolve, reject) {
        return this.get(cfgNum + "?full=1").then(function(res) {
          return resolve(res);
        })["catch"](function(e) {
          return reject(e);
        });
      });
      return d;
    };

    restConf.prototype.get = function(path) {
      var d, opt;
      opt = {
        host: this.host,
        port: this.port,
        path: this.path + path
      };
      if (this.args.user) {
        opt.headers = {
          Authorization: "Basic " + Buffer.from(this.args.user + ":" + this.args.password).toString('base64')
        };
      }
      d = new Promise(function(resolve, reject) {
        var req;
        return req = this.http.request(opts, function(resp) {
          var str;
          str = '';
          resp.on('data', function(chunk) {
            return str += chunk;
          });
          return resp.on('end', function() {
            var err, error, json, res;
            if (str) {
              res = '';
              try {
                json = JSON.parse(str);
                return resolve(json);
              } catch (error) {
                err = error;
                console.error("JSON parsing error: " + err);
                return reject("" + err);
              }
            } else {
              console.error("No response received");
              return reject(false);
            }
          });
        });
      });
      return d;
    };

    return restConf;

  })();

  module.exports = restConf;

}).call(this);
