(function() {
  /*
   * LemonLDAP::NG CDBI configuration accessor for Node.js/express
   *
   * See README.md for license and copyright
   */
  var _DBI, constants, rdbiConf;

  _DBI = require('lemonldap-ng-conf-dbi');

  constants = require('./confConstants');

  rdbiConf = class rdbiConf extends _DBI {
    load(cfgNum, fields) {
      var d, db, self, table;
      self = this;
      // TODO fields
      db = this.db.connect();
      table = this.table;
      d = new Promise(function(resolve, reject) {
        // TODO: change this to dc.query
        return db.fetchAll(`SELECT field,value FROM ${table} WHERE cfgNum=?`, [cfgNum], function(err, res) {
          var cfg, i, len, row;
          if (err) {
            self.logger.error(err);
            return reject(null);
          } else {
            try {
              cfg = {};
              for (i = 0, len = res.length; i < len; i++) {
                row = res[i];
                cfg[row.field] = row.value;
              }
              return resolve(self.unserialize(cfg));
            } catch (error) {
              err = error;
              self.logger.error(`Error when parsing configuration (${err})`);
              return reject(err);
            }
          }
        });
      });
      return d;
    }

    store() {
      return self.logger.error('TODO later');
    }

    unserialize(cfg) {
      var err, k, res, v;
      res = {};
      for (k in cfg) {
        v = cfg[k];
        if (k.match(constants.hashParameters)) {
          try {
            res[k] = JSON.parse(v);
          } catch (error) {
            err = error;
            Error(`Error when parsing ${k} field: (${err})`);
          }
        } else {
          res[k] = v;
        }
      }
      return res;
    }

  };

  module.exports = rdbiConf;

}).call(this);
