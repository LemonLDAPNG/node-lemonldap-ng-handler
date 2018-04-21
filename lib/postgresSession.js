(function() {
  var DBISession, MySQLSession, convert,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  DBISession = require('./dbiSession');

  convert = {
    database: 'database',
    dbname: 'database',
    host: 'host',
    port: 'port'
  };

  MySQLSession = (function(superClass) {
    extend(MySQLSession, superClass);

    function MySQLSession(opts) {
      var dbargs, dbiargs, i, k, len, t, t2, table, tmp;
      if (opts.DataSource.match(/^dbi:Pg:(.*$)/)) {
        dbiargs = RegExp.$1;
        table = opts.TableName ? opts.TableName : 'sessions';
        tmp = dbiargs.split(/;/);
        dbargs = {
          user: opts.UserName,
          password: opts.Password
        };
        for (i = 0, len = tmp.length; i < len; i++) {
          t = tmp[i];
          if (t.match(/=/)) {
            t2 = t.split(/=/);
            if (k = convert[t2[0]]) {
              dbargs[k] = t2[1];
            }
          } else {
            dbargs.database = t;
          }
        }
        MySQLSession.__super__.constructor.call(this, 'pg', dbargs);
      } else {
        console.error('Bad DataSource');
      }
    }

    return MySQLSession;

  })(DBISession);

  module.exports = MySQLSession;

}).call(this);
