
/*
 * LemonLDAP::NG configuration accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var conf;

  conf = (function() {
    conf.prototype.module = null;

    conf.prototype.confFile = process.env.LLNG_DEFAULTCONFFILE || '/etc/lemonldap-ng/lemonldap-ng.ini';

    conf.prototype.type = null;

    function conf(args) {
      var e, error, i, k, lc, len, m, ref;
      if (args == null) {
        args = {};
      }
      for (k in args) {
        this[k] = args[k];
      }
      lc = this.getLocalConf('configuration', this.confFile, 0);
      for (k in lc) {
        this[k] = lc[k];
      }
      if (!this.type.match(/^[\w:]+$/)) {
        console.log("Error: configStorage: type is not well formed.\n");
        return null;
      }
      try {
        m = require("./" + (this.type.toLowerCase()) + "Conf");
        this.module = new m(this);
      } catch (error) {
        e = error;
        console.log(e);
        return null;
      }
      console.log(this.type + ' module loaded');
      ref = ['available', 'lastCfg', 'lock', 'isLocked', 'unlock', 'store', 'load', 'delete'];
      for (i = 0, len = ref.length; i < len; i++) {
        k = ref[i];
        this[k] = this.module[k];
      }
      this;
    }

    conf.prototype.getConf = function(args) {
      var m, r;
      if (args == null) {
        args = {};
      }
      args.cfgNum || (args.cfgNum = this.module.lastCfg());
      if (!args.cfgNum) {
        console.log("No configuration available in backend.\n");
        return null;
      }
      r = this.module.load(args.cfgNum);
      if (!r) {
        console.log("Get configuration " + args.cfgNum + " failed\n");
        return null;
      }
      if (!args.raw) {
        m = require("./crypto");
        r.cipher = new m(r.key);
      }
      return r;
    };

    conf.prototype.getLocalConf = function(section, file, loadDefault) {
      var iniparser, k, ref, ref1, res, v;
      if (loadDefault == null) {
        loadDefault = true;
      }
      file = file || this.confFile;
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

    conf.prototype.saveConf = function(conf, args) {
      var last, tmp;
      if (args == null) {
        args = {};
      }
      last = this.module.lastCfg();
      if (!args.force) {
        if (conf.cfgNum !== last) {
          return -1;
        }
        if (this.module.isLocked() || !this.module.lock()) {
          return -3;
        }
      }
      if (!args.cfgNumFixed) {
        conf.cfgNum = last + 1;
      }
      delete conf.cipher;
      tmp = this.module.store(conf);
      if (!(tmp > 0)) {
        console.log("Configuration " + conf.cfgNum + " not stored\n");
        this.module.unlock();
        if (tmp != null) {
          return tmp;
        } else {
          return -2;
        }
      }
      console.log("Configuration " + conf.cfgNum + " stored\n");
      if (this.module.unlock()) {
        return tmp;
      } else {
        return -2;
      }
    };

    return conf;

  })();

  module.exports = conf;

}).call(this);
