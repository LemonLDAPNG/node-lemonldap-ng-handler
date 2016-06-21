
/*
 * LemonLDAP::NG configuration accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  exports.module = null;

  exports.confFile = process.env.LLNG_DEFAULTCONFFILE || '/etc/lemonldap-ng/lemonldap-ng.ini';

  exports.type = null;

  exports.init = function(args) {
    var e, error, i, k, lc, len, ref;
    if (args == null) {
      args = {};
    }
    for (k in args) {
      exports[k] = args[k];
    }
    lc = exports.getLocalConf('configuration', exports.confFile, 0);
    for (k in lc) {
      exports[k] = lc[k];
    }
    if (!exports.type.match(/^[\w:]+$/)) {
      console.log("Error: configStorage: type is not well formed.\n");
      return null;
    }
    try {
      exports.module = require("./" + (exports.type.toLowerCase()) + "Conf").init(exports);
    } catch (error) {
      e = error;
      console.log(e);
      return null;
    }
    console.log(exports.type + ' module loaded');
    ref = ['available', 'lastCfg', 'lock', 'isLocked', 'unlock', 'store', 'load', 'delete'];
    for (i = 0, len = ref.length; i < len; i++) {
      k = ref[i];
      exports[k] = exports.module[k];
    }
    return exports;
  };

  exports.getConf = function(args) {
    var r;
    if (args == null) {
      args = {};
    }
    args.cfgNum || (args.cfgNum = exports.module.lastCfg());
    if (!args.cfgNum) {
      console.log("No configuration available in backend.\n");
      return null;
    }
    r = exports.module.load(args.cfgNum);
    if (!r) {
      console.log("Get configuration " + args.cfgNum + " failed\n");
      return null;
    }
    if (!args.raw) {
      r.cipher = require("./crypto").init(r.key);
    }
    return r;
  };

  exports.getLocalConf = function(section, file, loadDefault) {
    var iniparser, k, ref, ref1, res, v;
    if (loadDefault == null) {
      loadDefault = true;
    }
    file = file || exports.confFile;
    iniparser = require('inireader').IniReader();
    iniparser.load(file);
    res = {};
    if (loadDefault) {
      ref = iniparser.param('all');
      for (k in ref) {
        v = ref[k];
        res[k] = v;
      }
    }
    if (section === 'all') {
      return res;
    }
    ref1 = iniparser.param(section);
    for (k in ref1) {
      v = ref1[k];
      res[k] = v;
    }
    return res;
  };

  exports.saveConf = function(conf, args) {
    var last, tmp;
    if (args == null) {
      args = {};
    }
    last = exports.module.lastCfg();
    if (!args.force) {
      if (conf.cfgNum !== last) {
        return -1;
      }
      if (exports.module.isLocked() || !exports.module.lock()) {
        return -3;
      }
    }
    if (!args.cfgNumFixed) {
      conf.cfgNum = last + 1;
    }
    delete conf.cipher;
    tmp = exports.module.store(conf);
    if (!(tmp > 0)) {
      console.log("Configuration " + conf.cfgNum + " not stored\n");
      exports.module.unlock();
      if (tmp != null) {
        return tmp;
      } else {
        return -2;
      }
    }
    console.log("Configuration " + conf.cfgNum + " stored\n");
    if (exports.module.unlock()) {
      return tmp;
    } else {
      return -2;
    }
  };

}).call(this);
