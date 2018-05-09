(function() {
  /*
   * LemonLDAP::NG handler initialization module for Node.js/express
   *
   * See README.md for license and copyright
   */
  var handlerConf;

  handlerConf = (function() {
    // TODO Reload mechanism, needed for cluster only:
    // see file:///usr/share/doc/nodejs/api/cluster.html "Event 'message'"
    class handlerConf {
      // Initialization method

      // Get local and global configuration
      constructor(args = {}) {
        var Logger, i, m;
        m = require('./conf');
        this.lmConf = new m(args.configStorage);
        if (!this.lmConf) {
          // TODO: change msg in LlngConf
          console.error("Unable to build configuration");
          return null;
        }
        this.localConfig = this.lmConf.getLocalConf('node-handler', null, 1);
        for (i in args) {
          this.localConfig[i] = args[i];
        }
        Logger = require('./logger');
        this.logger = new Logger(this.localConfig, 0);
        this.userLogger = new Logger(this.localConfig, 1);
        this.lmConf['logger'] = this.logger;
        if (this.localConfig.checkTime) {
          this.checkTime = this.localConfig.checkTime;
        }
        // logLevel
        //if @localConfig.logLevel
        //	if @logLevels[@localConfig.logLevel]?
        //		@localConfig.logLevel = @logLevels[@localConfig.logLevel]
        //	else
        //		console.error "Unknown log level '#{@localConfig.logLevel}'"

        // TODO: status

        // Load initial configuration
        this.reload();
      }

      // Note that checkConf isn't needed: no shared cache with node.js
      checkConf() {
        return this.logger.error("checkConf() must not be called");
      }

      // Configuration compilation

      // Compile LLNG configuration for performances
      reload() {
        var self;
        self = this;
        return this.lmConf.getConf({
          logger: this.logger
        }).then(function(conf) {
          var a, aliases, cond, h, headers, j, k, l, len, len1, len2, m, n, name, prot, ref, ref1, ref2, ref3, ref4, ref5, rule, rules, sessionStorageModule, sub, t, url, v, vConf, val, vhost, vhostList, w;
          for (k in self.localConfig) {
            conf[k] = self.localConfig[k];
          }
          self.logger.debug(`Virtualhosts configured for Node.js: ${conf.nodeVhosts}`);
          vhostList = conf.nodeVhosts ? conf.nodeVhosts.split(/[,\s]+/) : [];
          ref = ['cda', 'cookieExpiration', 'cipher', 'cookieName', 'customFunctions', 'httpOnly', 'securedCookie', 'timeoutActivity', 'useRedirectOnError', 'useRedirectOnForbidden', 'whatToTrace', 'loopBackUrl'];
          // Default values initialization
          for (j = 0, len = ref.length; j < len; j++) {
            w = ref[j];
            if (w !== 'cipher') {
              self.logger.debug(`Conf key ${w}: ${conf[w]}`);
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
                name = `vhost${w.unFirst()}`;
                ref2 = conf.vhostOptions;
                for (vhost in ref2) {
                  vConf = ref2[vhost];
                  val = vConf[name];
                  if (val > 0) {
                    // TODO: log
                    self.tsv[w][vhost] = val;
                  }
                }
              }
            }
          }
          // Portal initialization
          if (!conf.portal) {
            // TODO die
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
          // Location rules initialization
          for (vhost in ref3) {
            rules = ref3[vhost];
            if (vhostList.indexOf(vhost) !== -1) {
              self.logger.debug(`Compiling rules for ${vhost}`);
              self.tsv.locationCount[vhost] = 0;
              for (url in rules) {
                rule = rules[url];
                [cond, prot] = self.conditionSub(rule);
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
          // Sessions storage initialization
          if (!(sessionStorageModule = conf.globalStorage.replace(/^Apache::Session::(?:Browseable::)?/, ''))) {
            Error(`Unsupported session backend: ${conf.globalStorage}`);
          }
          m = require("./sessions");
          self.sa = new m(sessionStorageModule, self.logger, conf.globalStorageOptions);
          ref4 = conf.exportedHeaders;
          // Headers initialization
          for (vhost in ref4) {
            headers = ref4[vhost];
            if (vhostList.indexOf(vhost) !== -1) {
              self.logger.debug(`Compiling headers for ${vhost}`);
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
                sub += `'${h}': ${val},`;
              }
              sub = sub.replace(/,$/, '');
              eval(`self.tsv.forgeHeaders['${vhost}'] = function(session) {return {${sub}};}`);
            }
          }
          ref5 = conf.vhostOptions;
          // TODO: post url initialization

          // Alias initialization
          for (vhost in ref5) {
            aliases = ref5[vhost];
            if (aliases) {
              t = aliases.split(/\s+/);
              for (n = 0, len2 = t.length; n < len2; n++) {
                a = t[n];
                self.tsv.vhostAlias[a] = vhost;
              }
            }
          }
          self.tsv['cookieDetect'] = new RegExp(`\\b${self.tsv.cookieName}=([^;]+)`);
          return 1;
        }).catch(function(e) {
          return self.logger.error(`Can't get configuration: ${e}`);
        });
      }

      // Build expression into functions (used to control user access and build
      // headers)
      conditionSub(cond) {
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
        // TODO: manage app logout
        if (cond.match(/^logout(?:_sso|_app|_app_sso|)(?:\s+(.*))?$/i)) {
          url = RegExp.$1;
          if (url) {
            return [
              function(session) {
                session._logout = url;
                return 0;
              },
              0
            ];
          } else {
            return [
              function(session) {
                session._logout = this.tsv.portal();
                return 0;
              },
              0
            ];
          }
        }
        cond = this.substitute(cond);
        eval(`sub = function(req,session) {return (${cond});}`);
        return [sub, 0];
      }

      // Interpolate expressions
      substitute(expr) {
        // Special macros
        // Session attributes: $xx is replaced by session.xx
        return expr.replace(/\$date\b/g, 'this.date()').replace(/\$vhost\b/g, 'this.hostname(req)').replace(/\$ip\b/g, 'this.remote_ip(req)').replace(/\$(_*[a-zA-Z]\w*)/g, 'session.$1');
      }

      date() {
        var a, d, j, len, s, x;
        d = new Date();
        s = '';
        a = [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
        for (j = 0, len = a.length; j < len; j++) {
          x = a[j];
          s += x < 10 ? `0${x}` : `${x}`;
        }
        return s;
      }

      hostname(req) {
        return req.headers.host;
      }

      remote_ip(req) {
        if (req.ip != null) {
          return req.ip;
        } else {
          return req.cgiParams.REMOTE_ADDR;
        }
      }

    };

    handlerConf.prototype.tsv = {
      defaultCondition: {},
      defaultProtection: {},
      forgeHeaders: {},
      headerList: {},
      https: {},
      locationCondition: {},
      //locationConditionText: {}
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

    return handlerConf;

  }).call(this);

  module.exports = handlerConf;

}).call(this);
