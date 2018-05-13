(function() {
  /*
   * LemonLDAP::NG DevOps handler
   * (see https://lemonldap-ng.org/documentation/2.0/devopshandler)
   *
   * See README.md for license and copyright
   */
  var Handler, HandlerDevOps;

  Handler = require('./handler').class;

  HandlerDevOps = class HandlerDevOps extends Handler {
    constructor(args) {
      super(args);
    }

    // Override grant() to get application rules.json before checking access
    grant(req, uri, session) {
      var base, base1, d, lvOpts, self, up, vhost;
      vhost = this.resolveAlias(req);
      // Calculates rules.json URL
      self = this;
      (base1 = this.conf.tsv).lastVhostUpdate || (base1.lastVhostUpdate = {});
      // Initialize devops conf if needed (each 10mn)
      if (!(this.conf.tsv.defaultCondition[vhost] && (Date.now() / 1000 - this.conf.tsv.lastVhostUpdate[vhost] < 600))) {
        // TODO: FALSE !!!
        base = req.cgiParams && req.cgiParams['RULES_URL'] ? req.cgiParams['RULES_URL'] : `${this.conf.tsv.loopBackUrl || "http://127.0.0.1"}/rules.json`;
        if (!base.match(/^(https?):\/\/([^\/:]+)(?::(\d+))?(.*)$/)) {
          this.logger.error(`Bad loopBackUrl ${base}`);
        }
        lvOpts = {
          prot: RegExp.$1,
          host: RegExp.$2,
          path: RegExp.$4,
          port: RegExp.$3 || (RegExp.$1 === 'https' ? 443 : 80)
        };
        up = super.grant;
        d = new Promise(function(resolve, reject) {
          return self.loadVhostConfig(req, vhost, lvOpts).then(function() {
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

    loadVhostConfig(req, vhost, lvOpts) {
      var d, self;
      self = this;
      d = new Promise(function(resolve, reject) {
        var http, opts;
        // Verify URL
        // Build request
        opts = {
          host: lvOpts.host,
          path: lvOpts.path,
          port: lvOpts.port,
          headers: {
            Host: vhost
          }
        };
        // and launch it
        self.logger.debug(`Trying to get ${lvOpts.prot}://${lvOpts.host}:${lvOpts.port}${lvOpts.path}`);
        http = require(lvOpts.prot);
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
                  rule = new String(rule).valueOf();
                  self.logger.debug(`Compile ${rule}`);
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
                self.conf.tsv.lastVhostUpdate[vhost] = Date.now() / 1000;
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
            self.conf.tsv.lastVhostUpdate[vhost] = Date.now() / 1000;
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
