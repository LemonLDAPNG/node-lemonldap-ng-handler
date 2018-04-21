(function() {
  var DBISession, SQLite3Session,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  DBISession = require('./dbiSession');

  SQLite3Session = (function(superClass) {
    extend(SQLite3Session, superClass);

    function SQLite3Session(opts) {
      var db, table;
      if (opts.DataSource.match(/^dbi:SQLite:.*dbname=([\w\-\.\/]+)(.*$)/)) {
        db = RegExp.$1;
        table = opts.TableName ? opts.TableName : 'sessions';
        this.config = {
          path: db
        };
        SQLite3Session.__super__.constructor.call(this, 'sqlite3', this.config);
      } else {
        console.error('Bad DataSource');
      }
    }

    return SQLite3Session;

  })(DBISession);

  module.exports = SQLite3Session;

}).call(this);
