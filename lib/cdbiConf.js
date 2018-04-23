
/*
 * LemonLDAP::NG CDBI configuration accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var _DBI, cdbiConf,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  _DBI = require('./_dbiConf');

  cdbiConf = (function(superClass) {
    extend(cdbiConf, superClass);

    function cdbiConf() {
      return cdbiConf.__super__.constructor.apply(this, arguments);
    }

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

    cdbiConf.prototype.store = function() {
      return console.error('TODO later');
    };

    return cdbiConf;

  })(_DBI);

  module.exports = cdbiConf;

}).call(this);
