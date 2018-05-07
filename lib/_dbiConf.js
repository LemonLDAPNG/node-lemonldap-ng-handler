(function() {
  /*
   * LemonLDAP::NG super class for CDBI/RDBI
   *
   * See README.md for license and copyright
   */
  'use strict';
  var _dbiConf;

  _dbiConf = class _dbiConf {
    constructor(args) {
      var perlWrap;
      perlWrap = require('./perldbi');
      this.db = new perlWrap(args);
      this.table = args.dbiTable ? args.dbiTable : 'lmConfig';
    }

    available() {
      var d, db, self, table;
      self = this;
      db = this.db.connect();
      table = this.table;
      d = new Promise(function(resolve, reject) {
        var i, j, q, rc, ref, t;
        q = db.query(`SELECT cfgNum FROM ${table} ORDER BY cfgNum`);
        if (q) {
          rc = q.count();
          t = [];
          for (i = j = 1, ref = rc + 1; (1 <= ref ? j <= ref : j >= ref); i = 1 <= ref ? ++j : --j) {
            q.seek(i);
            t.push(q.value(1));
          }
          return resolve(t);
        } else {
          self.logger.error('No conf found in database');
          return resolve([]);
        }
      });
      return d;
    }

    lastCfg() {
      var d, db, table;
      db = this.db.connect();
      table = this.table;
      d = new Promise(function(resolve, reject) {
        var q;
        q = db.query(`SELECT max(cfgNum) FROM ${table} ORDER BY cfgNum`);
        if (q) {
          q.seek(1);
          return resolve(q.value(1));
        } else {
          self.logger.error('No conf found in database');
          return resolve([]);
        }
      });
      return d;
    }

    lock() {
      return this.logger.error('TODO later');
    }

    isLocked() {
      return this.logger.error('TODO later');
    }

    unlock() {
      return this.logger.error('TODO later');
    }

    delete() {
      return this.logger.error('TODO later');
    }

  };

  module.exports = _dbiConf;

}).call(this);
