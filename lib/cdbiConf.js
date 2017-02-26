
/*
 * LemonLDAP::NG CDBI configuration accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var DBExpr, DBWrapper, btype, cdbiConf;

  DBWrapper = require('node-dbi').DBWrapper;

  DBExpr = require('node-dbi').DBExpr;

  btype = {
    SQLite: "sqlite3",
    Pg: "pg",
    mysql: "mysql"
  };

  cdbiConf = (function() {
    function cdbiConf(args) {
      var conn, db, type;
      if (args.dbiChain.match(/^dbi:(SQLite|Pg|mysql):.*dbname=([\w\-\.\/]+)(.*$)/)) {
        type = RegExp.$1;
        db = RegExp.$2;
        conn = {
          database: db,
          user: args.dbiUser,
          password: args.dbiPassword
        };
        if (type === 'SQLite') {
          conn.path = db;
        }
        this.db = new DBWrapper(btype[type], conn);
        this.table = args.dbiTable ? args.dbiTable : 'lmConfig';
        this.db.connect();
      } else {
        console.log("Invalid dbiChain: " + args.dbiChain.match);
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
            console.log(err);
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
            console.log(err);
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
            console.log(err);
            return reject(null);
          } else {
            try {
              tmp = JSON.parse(res.data);
              return resolve(tmp);
            } catch (error) {
              err = error;
              console.log("Error when parsing session file (" + err + ")");
              return reject(err);
            }
          }
        });
      });
      return q;
    };

    cdbiConf.prototype.lock = function() {
      return console.log('TODO later');
    };

    cdbiConf.prototype.isLocked = function() {
      return console.log('TODO later');
    };

    cdbiConf.prototype.unlock = function() {
      return console.log('TODO later');
    };

    cdbiConf.prototype.store = function() {
      return console.log('TODO later');
    };

    cdbiConf.prototype["delete"] = function() {
      return console.log('TODO later');
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