(function() {
  /*
   * LemonLDAP::NG handler initialization module for Node.js/express
   *
   * See README.md for license and copyright
   */
  var HandlerConf, Iconv;

  // TODO Reload mechanism, needed for cluster only:
  // see file:///usr/share/doc/nodejs/api/cluster.html "Event 'message'"
  Iconv = null;

  HandlerConf = (function() {
    var basic, checkDate, checkLogonHours, date, groupMatch, hostname, isInNet6, iso2unicode, remote_ip, unicode2iso;

    class HandlerConf {
      // Initialization method

      // Get local and global configuration
      constructor(args = {}) {
        var Logger, e, i, m;
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
        try {
          Iconv = require('iconv').Iconv;
        } catch (error) {
          e = error;
          this.logger.notice("iconv module not available");
        }
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
          m = require('./sessions');
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
        var NOK, OK, sub, url;
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
        sub = null;
        eval(`sub = function(req,session) {return (${cond});}`);
        return [sub, 0];
      }

      // Interpolate expressions
      substitute(expr) {
        // Special macros
        // Session attributes: $xx is replaced by session.xx
        return expr.replace(/\$date\b/g, 'this.date()').replace(/\$vhost\b/g, 'this.hostname(req)').replace(/\$ip\b/g, 'this.remote_ip(req)').replace(/\$(_*[a-zA-Z]\w*)/g, 'session.$1');
      }

    };

    HandlerConf.prototype.tsv = {
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

    HandlerConf.prototype.cfgNum = 0;

    HandlerConf.prototype.lmConf = {};

    HandlerConf.prototype.localConfig = {};

    HandlerConf.prototype.logLevel = 'notice';

    HandlerConf.prototype.logLevels = {
      emerg: 7,
      alert: 6,
      crit: 5,
      error: 4,
      warn: 3,
      notice: 2,
      info: 1,
      debug: 0
    };

    HandlerConf.prototype.datas = {};

    HandlerConf.prototype.datasUpdate = 0;

    date = function() {
      var a, d, j, len, s, x;
      d = new Date();
      s = '';
      a = [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
      for (j = 0, len = a.length; j < len; j++) {
        x = a[j];
        s += x < 10 ? `0${x}` : `${x}`;
      }
      return s;
    };

    hostname = function(req) {
      return req.headers.host;
    };

    remote_ip = function(req) {
      if (req.ip != null) {
        return req.ip;
      } else {
        return req.cgiParams.REMOTE_ADDR;
      }
    };

    basic = function(login, pwd) {
      return "Basic " + unicode2iso(`${login}:${pwd}`).toString('base64');
    };

    groupMatch = function(groups, attr, value) {
      var group, j, len, match, re, ref, s, v;
      match = 0;
      re = new RegExp(value);
      for (group in groups) {
        v = groups[group];
        if (v[attr] != null) {
          if (typeof v[attr] === 'object') {
            ref = v[attr];
            for (j = 0, len = ref.length; j < len; j++) {
              s = ref[j];
              if (s.match(re)) {
                match++;
              }
            }
          } else {
            if (v[attr].match(re)) {
              match++;
            }
          }
        }
      }
      return match;
    };

    isInNet6 = function(ip, net) {
      var test;
      test = require('is-in-subnet');
      return test.isInSubnet(ip, net);
    };

    checkLogonHours = function(logonHours, syntax = 'hexadecimal', timeCorrection, defaultAccess = 0) {
      var d, div, hourPos, pos, v1, v2;
      timeCorrection = parseInt(timeCorrection);
      d = new Date();
      hourPos = d.getDay() * 24 + d.getHours() + timeCorrection;
      div = syntax === 'octetstring' ? 3 : 4;
      pos = Math.trunc(hourPos / div);
      v1 = Math.pow(2, hourPos % div);
      v2 = logonHours.substr(pos, 1);
      if (v2.match(/\d/)) {
        v2 = parseInt(v2); // Cast as int
      } else {
        v2 = v2.charCodeAt(0);
        v2 = v2 > 70 ? v2 - 87 : v2 - 55;
      }
      return v1 & v2;
    };

    checkDate = function(start = 0, end, defaultAccess = 0) {
      var d;
      start = start + '';
      start = start.substring(0, 14);
      end = end + '';
      end = end.substring(0, 14);
      if (!(start || end)) {
        return defaultAccess;
      }
      end || (end = 999999999999999);
      d = date();
      if (d >= start && d <= end) {
        return true;
      } else {
        return false;
      }
    };

    unicode2iso = function(s) {
      var iconv;
      iconv = new Iconv('UTF-8', 'ISO-8859-1');
      return iconv.convert(s);
    };

    iso2unicode = function(s) {
      var iconv;
      iconv = new Iconv('ISO-8859-1', 'UTF-8');
      return iconv.convert(s);
    };

    return HandlerConf;

  }).call(this);

  module.exports = HandlerConf;

}).call(this);
