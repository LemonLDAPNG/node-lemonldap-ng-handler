(function() {
  /*
   * LemonLDAP::NG handler for Node.js/express
   *
   * See README.md for license and copyright
   */
  var Handler, HandlerDevOps;

  Handler = require('./handler').class;

  HandlerDevOps = class HandlerDevOps extends Handler {
    constructor(args) {
      super(args);
      this.lvOpts = [];
    }

    grant(req, uri, session) {
      var base, base1, d, self, up, vhost;
      vhost = this.resolveAlias(req);
      // Initialize devps conf if needed
      if (!this.lvOpts.prot) {
        (base1 = this.conf.tsv).lastVhostUpdate || (base1.lastVhostUpdate = {});
        base = this.conf.tsv.loopBackUrl || "http://127.0.0.1"; // TODO arg + port
        if (!base.match(/^(https?):\/\/([^\/:]+)(?::(\d+))?(.*)$/)) {
          this.logger.error(`Bad loopBackUrl ${base}`);
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
        up = super.grant;
        d = new Promise(function(resolve, reject) {
          return self.loadVhostConfig(req, vhost).then(function() {
            return up.call(self, req, uri, session).then(function() {
              return resolve(true);
            }).catch(function(e) {
              return reject(e);
            });
          }).catch(function(e) {
            self.logger.error('E', e);
            return up.call(self, req, uri, session).then(function() {
              return resolve(true);
            }).catch(function(e) {
              return reject(e);
            });
          });
        });
        return d;
      } else {
        return super.grant(req, uri, session);
      }
    }

    loadVhostConfig(req, vhost) {
      var d, self;
      self = this;
      d = new Promise(function(resolve, reject) {
        var http, opts;
        // Verify URL
        // Build request
        opts = {
          host: self.lvOpts.host,
          path: self.lvOpts.path,
          port: self.lvOpts.port,
          headers: {
            Host: vhost
          }
        };
        // and launch it
        http = require(self.lvOpts.prot);
        req = http.request(opts, function(resp) {
          var str;
          str = '';
          resp.on('data', function(chunk) {
            return str += chunk;
          });
          return resp.on('end', function() {
            var cond, err, h, json, prot, ref, ref1, rule, rules, sub, url, v, val;
            if (str) {
              rules = '';
              try {
                json = JSON.parse(str);
                // Blank old rules
                self.conf.tsv.locationCondition[vhost] = [];
                self.conf.tsv.locationProtection[vhost] = [];
                self.conf.tsv.locationRegexp[vhost] = [];
                self.conf.tsv.locationCount = 0;
                self.conf.tsv.headerList[vhost] = [];
                ref = json.rules;
                // Parse rules
                for (url in ref) {
                  rule = ref[url];
                  [cond, prot] = self.conf.conditionSub(rule);
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
                // Parse headers
                sub = '';
                ref1 = json.headers;
                for (h in ref1) {
                  v = ref1[h];
                  self.conf.tsv.headerList[vhost].push(h);
                  val = self.conf.substitute(v);
                  sub += `'${h}': ${val},`;
                }
                sub = sub.replace(/,$/, '');
                eval(`self.conf.tsv.forgeHeaders['${vhost}'] = function(session) {return {${sub}};}`);
                return resolve();
              } catch (error) {
                err = error;
                self.logger.error(`JSON parsing error: ${err}`);
              }
            }
            self.logger.info("No rules found, apply default rule");
            self.conf.tsv.defaultCondition[vhost] = function() {
              return 1;
            };
            self.conf.tsv.defaultProtection = false;
            return resolve();
          });
        });
        req.on('error', function(e) {
          self.logger.error(`Unable to load rules.json: ${e.message}`);
          return reject();
        });
        return req.end();
      });
      return d;
    }

  };

  module.exports = HandlerDevOps;

}).call(this);
