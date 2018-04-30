
/*
 * LemonLDAP::NG DBI session accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var DBISession;

  DBISession = (function() {
    function DBISession(eng, config) {
      var base, perlWrap;
      this.eng = eng;
      this.config = config;
      perlWrap = require('./perldbi');
      this.db = new perlWrap(this.config);
      (base = this.config).table || (base.table = 'sessions');
    }

    DBISession.prototype.get = function(id) {
      var d, db, table;
      db = this.db.connect();
      table = this.config.table;
      d = new Promise(function(resolve, reject) {
        var err, error, q, tmp;
        q = db.query("SELECT a_session FROM " + table + " WHERE id=%1", [id]);
        if (q) {
          if (q.count() === 1) {
            q.seek(1);
            try {
              tmp = JSON.parse(q.value(1));
              return resolve(tmp);
            } catch (error) {
              err = error;
              console.error("Error when parsing session file (" + err + ")", res);
              return reject(err);
            }
          } else {
            console.log("Session " + id + " expired");
            return reject(false);
          }
        } else {
          console.error("Unable to query database");
          return reject(false);
        }
      });
      return d;
    };

    DBISession.prototype.update = function(id, data) {
      var d, db, table;
      db = this.db.connect();
      table = this.config.table;
      d = new Promise(function(resolve, reject) {
        var tmp;
        return tmp = {
          id: id,
          a_session: JSON.stringify(data)
        };
      });
      return d;
    };

    return DBISession;

  })();

  module.exports = DBISession;

}).call(this);
