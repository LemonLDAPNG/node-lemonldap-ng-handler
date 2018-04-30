
/*
 * LemonLDAP::NG super class for CDBI/RDBI
 *
 * See README.md for license and copyright
 */

(function() {
  var _dbiConf;

  _dbiConf = (function() {
    function _dbiConf(args) {
      var perlWrap;
      perlWrap = require('./perldbi');
      this.db = new perlWrap(args);
      this.table = args.dbiTable ? args.dbiTable : 'lmConfig';
    }

    _dbiConf.prototype.available = function() {
      var d, db, table;
      db = this.db.connect();
      table = this.table;
      d = new Promise(function(resolve, reject) {
        var i, j, q, rc, ref, t;
        q = db.query("SELECT cfgNum FROM " + table + " ORDER BY cfgNum");
        if (q) {
          rc = q.count();
          t = [];
          for (i = j = 1, ref = rc + 1; 1 <= ref ? j <= ref : j >= ref; i = 1 <= ref ? ++j : --j) {
            q.seek(i);
            t.push(q.value(1));
          }
          return resolve(t);
        } else {
          console.log('No conf found in database', err);
          return resolve([]);
        }
      });
      return d;
    };

    _dbiConf.prototype.lastCfg = function() {
      var d, db, table;
      db = this.db.connect();
      table = this.table;
      d = new Promise(function(resolve, reject) {
        var q;
        q = db.query("SELECT max(cfgNum) FROM " + table + " ORDER BY cfgNum");
        if (q) {
          q.seek(1);
          return resolve(q.value(1));
        } else {
          console.log('No conf found in database', err);
          return resolve([]);
        }
      });
      return d;
    };

    _dbiConf.prototype.lock = function() {
      return console.error('TODO later');
    };

    _dbiConf.prototype.isLocked = function() {
      return console.error('TODO later');
    };

    _dbiConf.prototype.unlock = function() {
      return console.error('TODO later');
    };

    _dbiConf.prototype["delete"] = function() {
      return console.error('TODO later');
    };

    return _dbiConf;

  })();

  module.exports = _dbiConf;

}).call(this);
