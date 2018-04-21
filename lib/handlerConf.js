
/*
 * LemonLDAP::NG handler initialization module for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var handlerConf;

  handlerConf = (function() {
    handlerConf.prototype.tsv = {
      defaultCondition: {},
      defaultProtection: {},
      forgeHeaders: {},
      headerList: {},
      https: {},
      locationCondition: {},
      locationCount: {},
      locationProtection: {},
      locationRegexp: {},
      maintenance: {},
      port: {},
      portal: '',
      vhostAlias: {},
      vhostOptions: {}
    };

    handlerConf.prototype.cfgNum = 0;

    handlerConf.prototype.lmConf = {};

    handlerConf.prototype.localConfig = {};

    handlerConf.prototype.logLevel = 'notice';

    handlerConf.prototype.logLevels = {
      emerg: 7,
      alert: 6,
      crit: 5,
      error: 4,
      warn: 3,
      notice: 2,
      info: 1,
      debug: 0
    };

    handlerConf.prototype.datas = {};

    handlerConf.prototype.datasUpdate = 0;

    function handlerConf(args) {
      var i, m;
      if (args == null) {
        args = {};
      }
      m = require('./conf');
      this.lmConf = new m(args.configStorage);
      if (!this.lmConf) {
        console.error("Unable to build configuration");
        return null;
      }
      this.localConfig = this.lmConf.getLocalConf('node-handler');
      for (i in args) {
        this.localConfig[i] = args[i];
      }
      if (this.localConfig.checkTime) {
        this.checkTime = this.localConfig.checkTime;
      }
      if (this.localConfig.logLevel) {
        if (this.logLevels[this.localConfig.logLevel] != null) {
          this.localConfig.logLevel = this.logLevels[this.localConfig.logLevel];
        } else {
          console.error("Unknown log level '" + this.localConfig.logLevel + "'");
        }
      }
      this.reload();
    }

    handlerConf.prototype.checkConf = function() {
      return console.error("checkConf() must not be called");
    };

    handlerConf.prototype.reload = function() {
      var self;
      self = this;
      return this.lmConf.getConf().then(function(conf) {
        var a, aliases, cond, h, headers, j, k, l, len, len1, len2, m, n, name, prot, ref, ref1, ref2, ref3, ref4, ref5, ref6, rule, rules, sessionStorageModule, sub, t, url, v, vConf, val, vhost, vhostList, w;
        for (k in self.localConfig) {
          conf[k] = self.localConfig[k];
        }
        console.log("Virtualhosts configured for Node.js", conf.nodeVhosts);
        vhostList = conf.nodeVhosts ? conf.nodeVhosts.split(/[,\s]+/) : [];
        ref = ['cda', 'cookieExpiration', 'cipher', 'cookieName', 'customFunctions', 'httpOnly', 'securedCookie', 'timeoutActivity', 'useRedirectOnError', 'useRedirectOnForbidden', 'whatToTrace', 'loopBackUrl'];
        for (j = 0, len = ref.length; j < len; j++) {
          w = ref[j];
          if (w !== 'cipher') {
            console.log("Conf key " + w + ":", conf[w]);
          }
          self.tsv[w] = conf[w];
        }
        ref1 = ['https', 'port', 'maintenance'];
        for (l = 0, len1 = ref1.length; l < len1; l++) {
          w = ref1[l];
          if (conf[w] != null) {
            self.tsv[w] = {
              _: conf[w]
            };
            if (conf.vhostOptions) {
              name = "vhost" + (w.unFirst());
              ref2 = conf.vhostOptions;
              for (vhost in ref2) {
                vConf = ref2[vhost];
                val = vConf[name];
                if (val > 0) {
                  self.tsv[w][vhost] = val;
                }
              }
            }
          }
        }
        if (!conf.portal) {
          1 / 0;
        }
        if (conf.portal.match(/[\$\(&\|"']/)) {
          self.tsv.portal = self.conditionSub(conf.portal);
        } else {
          self.tsv.portal = function() {
            return conf.portal;
          };
        }
        ref3 = conf.locationRules;
        for (vhost in ref3) {
          rules = ref3[vhost];
          if (vhostList.indexOf(vhost) !== -1) {
            console.log("Compiling rules for " + vhost);
            self.tsv.locationCount[vhost] = 0;
            for (url in rules) {
              rule = rules[url];
              ref4 = self.conditionSub(rule), cond = ref4[0], prot = ref4[1];
              if (url === 'default') {
                self.tsv.defaultCondition[vhost] = cond;
                self.tsv.defaultProtection[vhost] = prot;
              } else {
                if (self.tsv.locationCondition[vhost] == null) {
                  self.tsv.locationCondition[vhost] = [];
                }
                self.tsv.locationCondition[vhost].push(cond);
                if (self.tsv.locationProtection[vhost] == null) {
                  self.tsv.locationProtection[vhost] = [];
                }
                self.tsv.locationProtection[vhost].push(prot);
                if (self.tsv.locationRegexp[vhost] == null) {
                  self.tsv.locationRegexp[vhost] = [];
                }
                self.tsv.locationRegexp[vhost].push(new RegExp(url.replace(/\(\?#.*?\)/, '')));
                self.tsv.locationCount[vhost]++;
              }
            }
            if (!self.tsv.defaultCondition[vhost]) {
              self.tsv.defaultCondition[vhost] = function() {
                return 1;
              };
              self.tsv.defaultProtection = false;
            }
          }
        }
        if (!(sessionStorageModule = conf.globalStorage.replace(/^Apache::Session::(?:Browseable::)?/, ''))) {
          1 / 0;
        }
        m = require("./sessions");
        self.sa = new m(sessionStorageModule, conf.globalStorageOptions);
        ref5 = conf.exportedHeaders;
        for (vhost in ref5) {
          headers = ref5[vhost];
          if (vhostList.indexOf(vhost) !== -1) {
            console.log("Compiling headers for " + vhost);
            if (self.tsv.headerList[vhost] == null) {
              self.tsv.headerList[vhost] = [];
            }
            for (a in headers) {
              self.tsv.headerList[vhost].push(a);
            }
            sub = '';
            for (h in headers) {
              v = headers[h];
              val = self.substitute(v);
              sub += "'" + h + "': " + val + ",";
            }
            sub = sub.replace(/,$/, '');
            eval("self.tsv.forgeHeaders['" + vhost + "'] = function(session) {return {" + sub + "};}");
          }
        }
        ref6 = conf.vhostOptions;
        for (vhost in ref6) {
          aliases = ref6[vhost];
          if (aliases) {
            t = aliases.split(/\s+/);
            for (n = 0, len2 = t.length; n < len2; n++) {
              a = t[n];
              self.tsv.vhostAlias[a] = vhost;
            }
          }
        }
        self.tsv['cookieDetect'] = new RegExp("\\b" + self.tsv.cookieName + "=([^;]+)");
        return 1;
      })["catch"](function(e) {
        return console.error("Can't get configuration", e);
      });
    };

    handlerConf.prototype.conditionSub = function(cond) {
      var NOK, OK, url;
      OK = function() {
        return 1;
      };
      NOK = function() {
        return 0;
      };
      if (cond === 'accept') {
        return [OK, 0];
      }
      if (cond === 'deny') {
        return [NOK, 0];
      }
      if (cond === 'unprotect') {
        return [OK, 1];
      }
      if (cond === 'skip') {
        return [OK, 2];
      }
      if (cond.match(/^logout(?:_sso|_app|_app_sso|)(?:\s+(.*))?$/i)) {
        url = RegExp.$1;
        if (url) {
          return [
            function(session) {
              session._logout = url;
              return 0;
            }, 0
          ];
        } else {
          return [
            function(session) {
              session._logout = this.tsv.portal();
              return 0;
            }, 0
          ];
        }
      }
      cond = this.substitute(cond);
      eval("sub = function(req,session) {return (" + cond + ");}");
      return [sub, 0];
    };

    handlerConf.prototype.substitute = function(expr) {
      return expr.replace(/\$date\b/g, 'this.date()').replace(/\$vhost\b/g, 'this.hostname(req)').replace(/\$ip\b/g, 'this.remote_ip(req)').replace(/\$(_*[a-zA-Z]\w*)/g, 'session.$1');
    };

    handlerConf.prototype.date = function() {
      var a, d, j, len, s, x;
      d = new Date();
      s = '';
      a = [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
      for (j = 0, len = a.length; j < len; j++) {
        x = a[j];
        s += x < 10 ? "0" + x : "" + x;
      }
      return s;
    };

    handlerConf.prototype.hostname = function(req) {
      return req.headers.host;
    };

    handlerConf.prototype.remote_ip = function(req) {
      if (req.ip != null) {
        return req.ip;
      } else {
        return req.cgiParams.REMOTE_ADDR;
      }
    };

    return handlerConf;

  })();

  module.exports = handlerConf;

}).call(this);
