
/*
 * LemonLDAP::NG handler for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var Handler, HandlerDevOps,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Handler = require('./handler')["class"];

  HandlerDevOps = (function(superClass) {
    extend(HandlerDevOps, superClass);

    function HandlerDevOps(args) {
      HandlerDevOps.__super__.constructor.call(this, args);
      this.lvOpts = [];
    }

    HandlerDevOps.prototype.grant = function(req, uri, session) {
      var base, base1, d, self, vhost;
      vhost = this.resolveAlias(req);
      if (!this.lvOpts.prot) {
        (base1 = this.conf.tsv).lastVhostUpdate || (base1.lastVhostUpdate = {});
        base = this.conf.tsv.loopBackUrl || "http://127.0.0.1";
        if (!base.match(/^(https?):\/\/([^\/:]+)(?::(\d+))?(.*)$/)) {
          console.error("Bad loopBackUrl " + base);
        }
        this.lvOpts = {
          prot: RegExp.$1,
          host: RegExp.$2,
          path: '/rules.json',
          port: RegExp.$3 || (RegExp.$1 === 'https' ? 443 : 80)
        };
      }
      self = this;
      if (!(this.conf.tsv.defaultCondition[vhost] && (Date.now() / 1000 - this.conf.tsv.defaultCondition[vhost] < 600))) {
        return d = new Promise(function(resolve, reject) {
          return self.loadVhostConfig(req, vhost).then(function() {
            return HandlerDevOps.__super__.grant.call(self, req, uri, session).then(function() {
              return resolve(true);
            })["catch"](function(e) {
              return reject(e);
            });
          })["catch"](function(e) {
            console.log('E', e);
            HandlerDevOps.__super__.grant.call(self, req, uri, session).then(function() {});
            return HandlerDevOps.__super__.grant.call(this, req, uri, session).then(function() {
              return resolve(true);
            })["catch"](function(e) {
              return reject(e);
            });
          });
        });
      } else {
        return HandlerDevOps.__super__.grant.call(this, req, uri, session);
      }
    };

    HandlerDevOps.prototype.loadVhostConfig = function(req, vhost) {
      var d, self;
      self = this;
      d = new Promise(function(resolve, reject) {
        var http, opts;
        opts = {
          host: self.lvOpts.host,
          path: self.lvOpts.path,
          port: self.lvOpts.port,
          headers: {
            Host: vhost
          }
        };
        http = require(self.lvOpts.prot);
        req = http.request(opts, function(resp) {
          var str;
          str = '';
          resp.on('data', function(chunk) {
            return str += chunk;
          });
          return resp.on('end', function() {
            var cond, err, error, h, json, prot, ref, ref1, ref2, rule, rules, sub, url, v, val;
            if (str) {
              rules = '';
              try {
                json = JSON.parse(str);
                self.conf.tsv.locationCondition[vhost] = [];
                self.conf.tsv.locationProtection[vhost] = [];
                self.conf.tsv.locationRegexp[vhost] = [];
                self.conf.tsv.locationCount = 0;
                self.conf.tsv.headerList[vhost] = [];
                ref = json.rules;
                for (url in ref) {
                  rule = ref[url];
                  ref1 = self.conf.conditionSub(rule), cond = ref1[0], prot = ref1[1];
                  if (url === 'default') {
                    self.conf.tsv.defaultCondition[vhost] = cond;
                    self.conf.tsv.defaultProtection[vhost] = prot;
                  } else {
                    self.conf.tsv.locationCondition[vhost].push(cond);
                    self.conf.tsv.locationProtection[vhost].push(prot);
                    self.conf.tsv.locationRegexp[vhost].push(new RegExp(url.replace(/\(\?#.*?\)/, '')));
                    self.conf.tsv.locationCount[vhost]++;
                  }
                }
                if (!self.conf.tsv.defaultCondition[vhost]) {
                  self.conf.tsv.defaultCondition[vhost] = function() {
                    return 1;
                  };
                  self.conf.tsv.defaultProtection = false;
                }
                sub = '';
                ref2 = json.headers;
                for (h in ref2) {
                  v = ref2[h];
                  self.conf.tsv.headerList[vhost].push(h);
                  val = self.conf.substitute(v);
                  sub += "'" + h + "': " + val + ",";
                }
                sub = sub.replace(/,$/, '');
                eval("self.conf.tsv.forgeHeaders['" + vhost + "'] = function(session) {return {" + sub + "};}");
                return resolve();
              } catch (error) {
                err = error;
                console.error("JSON parsing error: " + err);
              }
            }
            console.log("No rules found, apply default rule");
            self.conf.tsv.defaultCondition[vhost] = function() {
              return 1;
            };
            self.conf.tsv.defaultProtection = false;
            return resolve();
          });
        });
        req.on('error', function(e) {
          console.error("Unable to load rules.json: " + e.message);
          return reject();
        });
        return req.end();
      });
      return d;
    };

    return HandlerDevOps;

  })(Handler);

  module.exports = HandlerDevOps;

}).call(this);
