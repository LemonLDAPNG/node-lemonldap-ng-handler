
/*
 * LemonLDAP::NG DBI session accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var DBISession, DBWrapper;

  DBWrapper = require('node-dbi').DBWrapper;

  DBISession = (function() {
    function DBISession(eng, config) {
      var base;
      this.eng = eng;
      this.config = config;
      this.db = new DBWrapper(this.eng, this.config);
      (base = this.config).table || (base.table = 'sessions');
      this.connect();
    }

    DBISession.prototype.get = function(id) {
      var db, q, table;
      db = this.connect();
      table = this.config.table;
      q = new Promise(function(resolve, reject) {
        return db.fetchRow("SELECT * FROM " + table + " WHERE id=?", [id], function(err, res) {
          var error, tmp;
          if (err) {
            console.log(err);
            return resolve(false);
          } else {
            try {
              tmp = JSON.parse(data.a_session);
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

    DBISession.prototype.update = function(id, data) {
      var db, q, table;
      db = this.connect();
      table = this.config.table;
      return q = new Promise(function(resolve, reject) {
        var tmp;
        tmp = {
          id: id,
          a_session: JSON.stringify(data)
        };
        return db.insert(table, tmp, function(err) {
          if (err) {
            return reject(err);
          } else {
            return resolve(true);
          }
        });
      });
    };

    DBISession.prototype.connect = function() {
      if (this.db.isConnected()) {
        return this.db;
      }
      this.db.connect();
      return this.db;
    };

    return DBISession;

  })();

  module.exports = DBISession;

}).call(this);
