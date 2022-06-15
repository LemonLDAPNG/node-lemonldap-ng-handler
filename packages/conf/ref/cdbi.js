(function() {
  /*
   * LemonLDAP::NG CDBI configuration accessor for Node.js/express
   *
   * See README.md for license and copyright
   */
  var _DBI, cdbiConf;

  _DBI = require('lemonldap-ng-conf-dbi');

  cdbiConf = class cdbiConf extends _DBI {
    load(cfgNum, fields) {
      var d, db, self, table;
      self = this;
      // TODO fields
      db = this.db.connect();
      table = this.table;
      d = new Promise(function(resolve, reject) {
        var data, err, q, tmp;
        q = db.query(`SELECT data FROM ${table} WHERE cfgNum=%1`, [cfgNum]);
        if (q) {
          q.seek(1);
          data = q.value(1);
          try {
            tmp = JSON.parse(data);
            return resolve(tmp);
          } catch (error) {
            err = error;
            self.logger.error(`Error when parsing session file (${err})`);
            return reject(err);
          }
        } else {
          self.logger.error(`Conf ${cfgNum} not found: ${d.lastError()}`);
          return reject(null);
        }
      });
      return d;
    }

    store() {
      return this.logger.error('TODO later');
    }

  };

  module.exports = cdbiConf;

}).call(this);
