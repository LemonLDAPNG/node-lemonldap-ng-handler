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

  exports.constructor = function(args) {
    var i;
    if (args == null) {
      args = {};
    }
    this.lmConf = new LlngConf(args.configStorage);
    if (!this.lmConf) {
      console.log("Unable to build configuration: " + LlngConfmsg);
      return null;
    }
    this.localConfig = this.lmConf.getLocalConf('handler');
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
        console.log("Unknown log level '" + this.localConfig.logLevel + "'");
      }
    }
    return this.reload();
  };

  exports.checkConf = function() {
    return console.log("checkConf() must not be called");
  };

  exports.reload = function() {
    var a, aliases, cond, conf, h, headers, j, k, l, len, len1, len2, name, prot, ref, ref1, ref2, ref3, ref4, ref5, ref6, rule, rules, sessionStorageModule, sub, t, url, v, vConf, val, vhost, w;
    conf = this.lmConf.getConf();
    if (conf == null) {
      console.log("Die");
      1 / 0;
    }
    ref = ['cda', 'cookieExpiration', 'cookieName', 'customFunctions', 'httpOnly', 'securedCookie', 'timeoutActivity', 'useRedirectOnError', 'useRedirectOnForbidden', 'whatToTrace'];
    for (j = 0, len = ref.length; j < len; j++) {
      w = ref[j];
      this.tsv[w] = conf[w];
    }
    this.tsv.cipher = new LlngCrypto(conf.key);
    ref1 = ['https', 'port', 'maintenance'];
    for (k = 0, len1 = ref1.length; k < len1; k++) {
      w = ref1[k];
      if (conf[w] != null) {
        this.tsv[w] = {
          _: conf[w]
        };
        if (conf.vhostOptions) {
          name = "vhost" + (w.unFirst());
          ref2 = conf.vhostOptions;
          for (vhost in ref2) {
            vConf = ref2[vhost];
            val = vConf[name];
            if (val > 0) {
              this.tsv[w][vhost] = val;
            }
          }
        }
      }
    }
    if (!conf.portal) {
      1 / 0;
    }
    if (conf.portal.match(/[\$\(&\|"']/)) {
      this.tsv.portal = this.conditionSub(conf.portal);
    } else {
      this.tsv.portal = function() {
        return conf.portal;
      };
    }
    ref3 = conf.locationRules;
    for (vhost in ref3) {
      rules = ref3[vhost];
      this.tsv.locationCount[vhost] = 0;
      for (url in rules) {
        rule = rules[url];
        ref4 = this.conditionSub(rule), cond = ref4[0], prot = ref4[1];
        if (url === 'default') {
          this.tsv.defaultCondition[vhost] = cond;
          this.tsv.defaultProtection[vhost] = prot;
        } else {
          if (this.tsv.locationCondition[vhost] == null) {
            this.tsv.locationCondition[vhost] = [];
          }
          this.tsv.locationCondition[vhost].push(cond);
          if (this.tsv.locationProtection[vhost] == null) {
            this.tsv.locationProtection[vhost] = [];
          }
          this.tsv.locationProtection[vhost].push(prot);
          if (this.tsv.locationRegexp[vhost] == null) {
            this.tsv.locationRegexp[vhost] = [];
          }
          this.tsv.locationRegexp[vhost].push(new RegExp(url.replace(/\(\?#.*?\)/, '')));
          this.tsv.locationCount[vhost]++;
        }
      }
      if (!this.tsv.defaultCondition[vhost]) {
        this.tsv.defaultCondition[vhost] = function() {
          return 1;
        };
        this.tsv.defaultProtection = 0;
      }
    }
    if (!(sessionStorageModule = conf.globalStorage.replace(/^Apache::Session::/, ''))) {
      1 / 0;
    }
    this.sa = new exports[sessionStorageModule + "SessionReader"](conf.globalStorageOptions);
    ref5 = conf.exportedHeaders;
    for (vhost in ref5) {
      headers = ref5[vhost];
      if (this.tsv.headerList[vhost] == null) {
        this.tsv.headerList[vhost] = [];
      }
      for (a in headers) {
        this.tsv.headerList[vhost].push(a);
      }
      sub = '';
      for (h in headers) {
        v = headers[h];
        val = this.substitute(v);
        sub += "'" + h + "': " + val + ",";
      }
      sub = sub.replace(/,$/, '');
      eval("this.tsv.forgeHeaders['" + vhost + "'] = function() {return {" + sub + "};}");
    }
    ref6 = conf.vhostOptions;
    for (vhost in ref6) {
      aliases = ref6[vhost];
      if (aliases) {
        t = aliases.split(/\s+/);
        for (l = 0, len2 = t.length; l < len2; l++) {
          a = t[l];
          this.tsv.vhostAlias[a] = vhost;
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
          exports._logout = this.tsv.portal();
          return 0;
        };
      }
    }
    cond = this.substitute(cond);
    eval("sub = function() {return (" + cond + ");}");
    return [sub, 0];
  };

  exports.substitute = function(expr) {
    return expr.replace(/\$date\b/, 'this.date()').replace(/\$vhost\b/, 'this.hostname()').replace(/\$ip\b/, 'this.remote_ip()').replace(/\$(_*[a-zA-Z]\w*)/g, 'this.datas.$1');
  };

  exports.date = function() {};

  exports.hostname = function() {};

  ({
    remote_ip: function() {}
  });

}).call(this);
