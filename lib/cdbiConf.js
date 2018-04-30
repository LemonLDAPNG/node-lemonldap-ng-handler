
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
      var d, db, table;
      db = this.db.connect();
      table = this.table;
      d = new Promise(function(resolve, reject) {
        var data, err, error, q, tmp;
        q = db.query("SELECT data FROM " + table + " WHERE cfgNum=%1", [cfgNum]);
        if (q) {
          q.seek(1);
          data = q.value(1);
          try {
            tmp = JSON.parse(data);
            return resolve(tmp);
          } catch (error) {
            err = error;
            console.error("Error when parsing session file (" + err + ")");
            return reject(err);
          }
        } else {
          console.error("Conf " + cfgNum + " not found", d.lastError());
          return reject(null);
        }
      });
      return d;
    };

    cdbiConf.prototype.store = function() {
      return console.error('TODO later');
    };

    return cdbiConf;

  })(_DBI);

  module.exports = cdbiConf;

}).call(this);
