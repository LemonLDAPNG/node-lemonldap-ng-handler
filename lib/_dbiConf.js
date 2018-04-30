
/*
 * LemonLDAP::NG super class for CDBI/RDBI
 *
 * See README.md for license and copyright
 */

(function() {
  var DBWrapper, _dbiConf, btype, convert;

  DBWrapper = require('nodedbi');

  btype = {
    SQLite: "sqlite3",
    Pg: "pg",
    mysql: "mysql"
  };

  convert = {
    database: 'dbname',
    dbname: 'dbname',
    host: 'host',
    port: 'port',
    encoding: 'encoding'
  };

  _dbiConf = (function() {
    function _dbiConf(args) {
      var j, k, len, t, t2, tmp, type;
      if (args.dbiChain.match(/^dbi:(SQLite|Pg|mysql):(.*)/)) {
        type = btype[RegExp.$1];
        if (!type) {
          Error("Unsupported database type: " + RegExp.$1);
        }
        tmp = RegExp.$2.split(/;/);
        this.dbargs = {
          type: type
        };
        for (j = 0, len = tmp.length; j < len; j++) {
          t = tmp[j];
          if (t2 = t.match(/^(.*?)=(.*)$/)) {
            if (k = convert[t2[1]]) {
              this.dbargs[k] = t2[2];
            }
          }
        }
        if (type === 'sqlite3') {
          if (this.dbargs.dbname.match(/^(.*)[\\\/](.*?)$/)) {
            this.dbargs.dbname = RegExp.$2;
            this.dbargs.sqlite3_dbdir = RegExp.$1;
          } else {
            this.dbargs.sqlite3_dbdir = '.';
          }
        } else {
          this.dbargs.user = args.dbiUser;
          this.dbargs.password = args.dbiPassword;
        }
        this.connect();
        this.table = args.dbiTable ? args.dbiTable : 'lmConfig';
      } else {
        console.error("Invalid dbiChain: " + args.dbiChain);
        process.exit(1);
      }
    }

    _dbiConf.prototype.available = function() {
      var d, db, table;
      db = this.connect();
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
      db = this.connect();
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

    _dbiConf.prototype.connect = function() {
      if (this.db) {
        return this.db;
      }
      this.db = DBWrapper.DBConnection(this.dbargs);
      if (!this.db) {
        console.error('Connection failed', this.dbargs);
        Error('Unable to connect to database');
      }
      return this.db;
    };

    return _dbiConf;

  })();

  module.exports = _dbiConf;

}).call(this);
