
/*
 * LemonLDAP::NG CDBI configuration accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var _DBI, constants, rdbiConf,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  _DBI = require('./_dbiConf');

  constants = require('./confConstants');

  rdbiConf = (function(superClass) {
    extend(rdbiConf, superClass);

    function rdbiConf() {
      return rdbiConf.__super__.constructor.apply(this, arguments);
    }

    rdbiConf.prototype.load = function(cfgNum, fields) {
      var db, q, self, table;
      self = this;
      db = this.connect();
      table = this.table;
      q = new Promise(function(resolve, reject) {
        return db.fetchAll("SELECT field,value FROM " + table + " WHERE cfgNum=?", [cfgNum], function(err, res) {
          var cfg, error, i, len, row;
          if (err) {
            console.error(err);
            return reject(null);
          } else {
            try {
              cfg = {};
              for (i = 0, len = res.length; i < len; i++) {
                row = res[i];
                cfg[row.field] = row.value;
              }
              console.log('COUCOU', cfg);
              return resolve(self.unserialize(cfg));
            } catch (error) {
              err = error;
              console.error("Error when parsing configuration (" + err + ")");
              return reject(err);
            }
          }
        });
      });
      return q;
    };

    rdbiConf.prototype.store = function() {
      return console.error('TODO later');
    };

    rdbiConf.prototype.unserialize = function(cfg) {
      var err, error, k, res, v;
      res = {};
      for (k in cfg) {
        v = cfg[k];
        if (k.match(constants.hashParameters)) {
          try {
            res[k] = JSON.parse(v);
          } catch (error) {
            err = error;
            Error("Error when parsing " + k + " field: (" + err + ")");
          }
        } else {
          res[k] = v;
        }
      }
      return res;
    };

    return rdbiConf;

  })(_DBI);

  module.exports = rdbiConf;

}).call(this);
