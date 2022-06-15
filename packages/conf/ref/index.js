(function() {
  /*
   * LemonLDAP::NG configuration accessor for Node.js/express
   *
   * See README.md for license and copyright
   */
  var conf;

  conf = (function() {
    class conf {
      constructor(args = {}) {
        var e, err, k, lc, m;
        for (k in args) {
          this[k] = args[k];
        }
        lc = this.getLocalConf('configuration', this.confFile, 0);
        for (k in lc) {
          this[k] = lc[k];
        }
        if (!this.type.match(/^[\w:]+$/)) {
          console.error("Error: configStorage: type is not well formed.\n");
          return null;
        }
        try {
          m = require(`./${this.type.toLowerCase()}`);
          this.module = new m(this);
        } catch (error) {
          err = error;
          try {
            m = require(`lemonldap-ng-conf-${this.type.toLowerCase()}`);
            this.module = new m(this);
          } catch (error) {
            e = error;
            console.error(err);
            console.error(e);
            return null;
          }
        }
      }

      //for k in ['available','lastCfg','lock','isLocked','unlock','store','load','delete']
      //	this[k] = @module[k]
      getConf(args = {}) {
        var d, mod, self;
        self = this;
        mod = this.module;
        d = new Promise(function(resolve, reject) {
          return mod.lastCfg().then(function(cn) {
            args.cfgNum || (args.cfgNum = cn);
            if (!args.cfgNum) {
              reject("No configuration available in backend.\n");
            }
            return mod.load(args.cfgNum).then(function(r) {
              var m;
              if (!args.raw) {
                m = require("./crypto");
                r.cipher = new m(r.key);
              }
              self.logger.debug(`Configuration ${args.cfgNum} loaded`);
              return resolve(r);
            }).catch(function(e) {
              self.logger.error(`Get configuration ${args.cfgNum} failed\n`, e);
              return reject(null);
            });
          }).catch(function(e) {
            return self.logger.error(`No last cfg: ${e}`);
          });
        });
        return d;
      }

      getLocalConf(section, file, loadDefault = false) {
        var iniparser, k, ref, ref1, res, v;
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
        ref1 = iniparser.param(section);
        for (k in ref1) {
          v = ref1[k];
          res[k] = v;
        }
        for (k in res) {
          v = res[k];
          if (v.match(/^\s*\{/)) {
            v = v.replace(/(\w+)\s*=>/g, '"$1":').replace(/:\s*'([^']+)'/g, ':"$1"');
            res[k] = JSON.parse(v);
          }
        }
        return res;
      }

      saveConf(conf, args = {}) {
        var last, tmp;
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
          this.logger.error(`Configuration ${conf.cfgNum} not stored\n`);
          this.module.unlock();
          if (tmp != null) {
            return tmp;
          } else {
            return -2;
          }
        }
        this.logger.info(`Configuration ${conf.cfgNum} stored\n`);
        if (this.module.unlock()) {
          return tmp;
        } else {
          return -2;
        }
      }

    };

    conf.prototype.module = null;

    conf.prototype.confFile = process.env.LLNG_DEFAULTCONFFILE || '/etc/lemonldap-ng/lemonldap-ng.ini';

    conf.prototype.type = null;

    return conf;

  }).call(this);

  module.exports = conf;

}).call(this);
