
/*
 * LemonLDAP::NG handler initialization module for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  exports.tsv = {
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

  exports.cfgNum = 0;

  exports.lmConf = {};

  exports.localConfig = {};

  exports.logLevel = 'notice';

  exports.logLevels = {
    emerg: 7,
    alert: 6,
    crit: 5,
    error: 4,
    warn: 3,
    notice: 2,
    info: 1,
    debug: 0
  };

  exports.sa = {};

  exports.session = {};

  exports.datas = {};

  exports.datasUpdate = 0;

  exports.init = function(args) {
    var i;
    if (args == null) {
      args = {};
    }
    exports.lmConf = require('./conf').init(args.configStorage);
    if (!exports.lmConf) {
      console.log("Unable to build configuration");
      return null;
    }
    exports.localConfig = exports.lmConf.getLocalConf('handler');
    for (i in args) {
      exports.localConfig[i] = args[i];
    }
    if (exports.localConfig.checkTime) {
      exports.checkTime = exports.localConfig.checkTime;
    }
    if (exports.localConfig.logLevel) {
      if (exports.logLevels[exports.localConfig.logLevel] != null) {
        exports.localConfig.logLevel = exports.logLevels[exports.localConfig.logLevel];
      } else {
        console.log("Unknown log level '" + exports.localConfig.logLevel + "'");
      }
    }
    exports.reload();
    return exports;
  };

  exports.checkConf = function() {
    return console.log("checkConf() must not be called");
  };

  exports.reload = function() {
    var a, aliases, cond, conf, h, headers, j, k, l, len, len1, len2, name, prot, ref, ref1, ref2, ref3, ref4, ref5, ref6, rule, rules, sessionStorageModule, sub, t, url, v, vConf, val, vhost, w;
    conf = exports.lmConf.getConf();
    if (conf == null) {
      console.log("Die");
      1 / 0;
    }
    ref = ['cda', 'cookieExpiration', 'cipher', 'cookieName', 'customFunctions', 'httpOnly', 'securedCookie', 'timeoutActivity', 'useRedirectOnError', 'useRedirectOnForbidden', 'whatToTrace'];
    for (j = 0, len = ref.length; j < len; j++) {
      w = ref[j];
      exports.tsv[w] = conf[w];
    }
    ref1 = ['https', 'port', 'maintenance'];
    for (k = 0, len1 = ref1.length; k < len1; k++) {
      w = ref1[k];
      if (conf[w] != null) {
        exports.tsv[w] = {
          _: conf[w]
        };
        if (conf.vhostOptions) {
          name = "vhost" + (w.unFirst());
          ref2 = conf.vhostOptions;
          for (vhost in ref2) {
            vConf = ref2[vhost];
            val = vConf[name];
            if (val > 0) {
              exports.tsv[w][vhost] = val;
            }
          }
        }
      }
    }
    if (!conf.portal) {
      1 / 0;
    }
    if (conf.portal.match(/[\$\(&\|"']/)) {
      exports.tsv.portal = exports.conditionSub(conf.portal);
    } else {
      exports.tsv.portal = function() {
        return conf.portal;
      };
    }
    ref3 = conf.locationRules;
    for (vhost in ref3) {
      rules = ref3[vhost];
      exports.tsv.locationCount[vhost] = 0;
      for (url in rules) {
        rule = rules[url];
        ref4 = exports.conditionSub(rule), cond = ref4[0], prot = ref4[1];
        if (url === 'default') {
          exports.tsv.defaultCondition[vhost] = cond;
          exports.tsv.defaultProtection[vhost] = prot;
        } else {
          if (exports.tsv.locationCondition[vhost] == null) {
            exports.tsv.locationCondition[vhost] = [];
          }
          exports.tsv.locationCondition[vhost].push(cond);
          if (exports.tsv.locationProtection[vhost] == null) {
            exports.tsv.locationProtection[vhost] = [];
          }
          exports.tsv.locationProtection[vhost].push(prot);
          if (exports.tsv.locationRegexp[vhost] == null) {
            exports.tsv.locationRegexp[vhost] = [];
          }
          exports.tsv.locationRegexp[vhost].push(new RegExp(url.replace(/\(\?#.*?\)/, '')));
          exports.tsv.locationCount[vhost]++;
        }
      }
      if (!exports.tsv.defaultCondition[vhost]) {
        exports.tsv.defaultCondition[vhost] = function() {
          return 1;
        };
        exports.tsv.defaultProtection = 0;
      }
    }
    if (!(sessionStorageModule = conf.globalStorage.replace(/^Apache::Session::/, ''))) {
      1 / 0;
    }
    exports.sa = require("./" + (sessionStorageModule.toLowerCase()) + "Session").init(conf.globalStorageOptions);
    ref5 = conf.exportedHeaders;
    for (vhost in ref5) {
      headers = ref5[vhost];
      if (exports.tsv.headerList[vhost] == null) {
        exports.tsv.headerList[vhost] = [];
      }
      for (a in headers) {
        exports.tsv.headerList[vhost].push(a);
      }
      sub = '';
      for (h in headers) {
        v = headers[h];
        val = exports.substitute(v);
        sub += "'" + h + "': " + val + ",";
      }
      sub = sub.replace(/,$/, '');
      eval("exports.tsv.forgeHeaders['" + vhost + "'] = function(session) {return {" + sub + "};}");
    }
    ref6 = conf.vhostOptions;
    for (vhost in ref6) {
      aliases = ref6[vhost];
      if (aliases) {
        t = aliases.split(/\s+/);
        for (l = 0, len2 = t.length; l < len2; l++) {
          a = t[l];
          exports.tsv.vhostAlias[a] = vhost;
        }
      }
    }
    return 1;
  };

  exports.conditionSub = function(cond) {
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
        return function() {
          exports._logout = url;
          return 0;
        };
      } else {
        return function() {
          exports._logout = exports.tsv.portal();
          return 0;
        };
      }
    }
    cond = exports.substitute(cond);
    console.log("sub = function(session) {return (" + cond + ");}");
    eval("sub = function(session) {return (" + cond + ");}");
    return [sub, 0];
  };

  exports.substitute = function(expr) {
    return expr.replace(/\$date\b/, 'exports.date()').replace(/\$vhost\b/, 'exports.hostname()').replace(/\$ip\b/, 'exports.remote_ip()').replace(/\$(_*[a-zA-Z]\w*)/g, 'session.$1');
  };

  exports.date = function() {};

  exports.hostname = function() {};

  exports.remote_ip = function() {};

}).call(this);
