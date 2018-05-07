(function() {
  /*
   * Perl style DBI wrapper
   *
   * See README.md for license and copyright
   */
  var DBWrapper, PerlDBI, btype, convert;

  DBWrapper = require('nodedbi');

  btype = {
    SQLite: "sqlite3",
    Pg: "pg",
    mysql: "mysql"
  };

  convert = {
    database: 'dbname',
    dbname: 'dbname',
    host: 'host',
    port: 'port',
    encoding: 'encoding'
  };

  PerlDBI = class PerlDBI {
    constructor(args) {
      var i, k, len, t, t2, tmp, type;
      if (args.dbiChain.match(/^dbi:(SQLite|Pg|mysql):(.*)/)) {
        type = btype[RegExp.$1];
        if (!type) {
          Error(`Unsupported database type: ${RegExp.$1}`);
        }
        tmp = RegExp.$2.split(/;/);
        this.dbargs = {
          type: type
        };
        for (i = 0, len = tmp.length; i < len; i++) {
          t = tmp[i];
          if (t2 = t.match(/^(.*?)=(.*)$/)) {
            if (k = convert[t2[1]]) {
              this.dbargs[k] = t2[2];
            }
          }
        }
        if (type === 'sqlite3') {
          if (this.dbargs.dbname.match(/^(.*)[\\\/](.*?)$/)) {
            this.dbargs.dbname = RegExp.$2;
            this.dbargs.sqlite3_dbdir = RegExp.$1;
          } else {
            this.dbargs.sqlite3_dbdir = '.';
          }
        } else {
          this.dbargs.user = args.dbiUser;
          this.dbargs.password = args.dbiPassword;
        }
        this.connect();
      } else {
        Error(`Invalid dbiChain: ${args.dbiChain}`);
      }
    }

    connect() {
      if (this.db) {
        return this.db;
      }
      this.db = DBWrapper.DBConnection(this.dbargs);
      if (!this.db) {
        console.error('Connection failed', this.dbargs);
        Error('Unable to connect to database');
      }
      return this.db;
    }

  };

  module.exports = PerlDBI;

}).call(this);
