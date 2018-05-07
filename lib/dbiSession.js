(function() {
  /*
   * LemonLDAP::NG DBI session accessor for Node.js/express
   *
   * See README.md for license and copyright
   */
  'use strict';
  var DBISession;

  DBISession = class DBISession {
    constructor(eng, logger, config) {
      var base, perlWrap;
      this.eng = eng;
      this.logger = logger;
      this.config = config;
      perlWrap = require('./perldbi');
      this.db = new perlWrap(this.config);
      (base = this.config).table || (base.table = 'sessions');
    }

    // get(): Recover session data
    get(id) {
      var d, db, self, table;
      self = this;
      db = this.db.connect();
      table = this.config.table;
      d = new Promise(function(resolve, reject) {
        var err, q, tmp;
        q = db.query(`SELECT a_session FROM ${table} WHERE id=%1`, [id]);
        if (q) {
          if (q.count() === 1) {
            q.seek(1);
            try {
              tmp = JSON.parse(q.value(1));
              return resolve(tmp);
            } catch (error) {
              err = error;
              self.logger.error(`Error when parsing session file (${err})`, res);
              return reject(err);
            }
          } else {
            self.logger.info(`Session ${id} expired`);
            return reject(false);
          }
        } else {
          self.logger.error("Unable to query database");
          return reject(false);
        }
      });
      return d;
    }

    update(id, data) {
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
      //db.insert table, tmp, (err) ->
      //	if err
      //		reject err
      //	else
      //		resolve true
      return d;
    }

  };

  module.exports = DBISession;

}).call(this);
