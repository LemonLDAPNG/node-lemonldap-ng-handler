(function() {
  'use strict';
  var DBISession, PgSession, convert;

  DBISession = require('./dbiSession');

  convert = {
    database: 'database',
    dbname: 'database',
    host: 'host',
    port: 'port'
  };

  PgSession = class PgSession extends DBISession {
    constructor(logger, opts) {
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
        super('pg', logger, dbargs);
      } else {
        logger.error('Bad DataSource');
      }
    }

  };

  module.exports = PgSession;

}).call(this);
