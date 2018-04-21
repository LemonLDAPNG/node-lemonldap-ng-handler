
/*
 * LemonLDAP::NG CDBI configuration accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var DBExpr, DBWrapper, btype, cdbiConf, convert;

  DBWrapper = require('node-dbi').DBWrapper;

  DBExpr = require('node-dbi').DBExpr;

  btype = {
    SQLite: "sqlite3",
    Pg: "pg",
    mysql: "mysql"
  };

  convert = {
    database: 'database',
    dbname: 'database',
    host: 'host',
    port: 'port'
  };

  cdbiConf = (function() {
    function cdbiConf(args) {
      var dbargs, dbiargs, i, k, len, t, t2, tmp, type;
      if (args.dbiChain.match(/^dbi:(SQLite|Pg|mysql):(.*)/)) {
        type = btype[RegExp.$1];
        dbiargs = RegExp.$2;
        tmp = dbiargs.split(/;/);
        dbargs = {
          user: args.dbiUser,
          password: args.dbiPassword
        };
        for (i = 0, len = tmp.length; i < len; i++) {
          t = tmp[i];
          t2 = t.split(/=/);
          if (t.match(/=/)) {
            if (k = convert[t2[0]]) {
              dbargs[k] = t2[1];
            }
          }
        }
        if (type === 'sqlite3') {
          dbargs.path = dbargs.database;
        }
        this.db = new DBWrapper(type, dbargs);
        this.table = args.dbiTable ? args.dbiTable : 'lmConfig';
        this.db.connect();
      } else {
        console.error("Invalid dbiChain: " + args.dbiChain);
        process.exit(1);
      }
    }

    cdbiConf.prototype.available = function() {
      var db, q, table;
      db = this.connect();
      table = this.table;
      q = new Promise(function(resolve, reject) {
        return db.fetchCol("SELECT cfgNum FROM " + table + " ORDER BY cfgNum", null, function(err, res) {
          if (err) {
            console.error(err);
            return resolve([]);
          } else {
            return resolve(res);
          }
        });
      });
      return q;
    };

    cdbiConf.prototype.lastCfg = function() {
      var db, q, table;
      db = this.connect();
      table = this.table;
      q = new Promise(function(resolve, reject) {
        return db.fetchOne("SELECT max(cfgNum) FROM " + table + " ORDER BY cfgNum", [], function(err, res) {
          if (err) {
            console.error(err);
            return reject(null);
          } else {
            return resolve(res);
          }
        });
      });
      return q;
    };

    cdbiConf.prototype.load = function(cfgNum, fields) {
      var db, q, table;
      db = this.connect();
      table = this.table;
      q = new Promise(function(resolve, reject) {
        return db.fetchRow("SELECT data FROM " + table + " WHERE cfgNum=?", [cfgNum], function(err, res) {
          var error, tmp;
          if (err) {
            console.error(err);
            return reject(null);
          } else {
            try {
              tmp = JSON.parse(res.data);
              return resolve(tmp);
            } catch (error) {
              err = error;
              console.error("Error when parsing session file (" + err + ")");
              return reject(err);
            }
          }
        });
      });
      return q;
    };

    cdbiConf.prototype.lock = function() {
      return console.error('TODO later');
    };

    cdbiConf.prototype.isLocked = function() {
      return console.error('TODO later');
    };

    cdbiConf.prototype.unlock = function() {
      return console.error('TODO later');
    };

    cdbiConf.prototype.store = function() {
      return console.error('TODO later');
    };

    cdbiConf.prototype["delete"] = function() {
      return console.error('TODO later');
    };

    cdbiConf.prototype.connect = function() {
      if (this.db.isConnected()) {
        return this.db;
      }
      this.db.connect();
      return this.db;
    };

    return cdbiConf;

  })();

  module.exports = cdbiConf;

}).call(this);
