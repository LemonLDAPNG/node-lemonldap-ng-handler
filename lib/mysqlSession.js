(function() {
  var DBISession, MySQLSession,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  DBISession = require('dbiSession');

  MySQLSession = (function(superClass) {
    extend(MySQLSession, superClass);

    function MySQLSession(opts) {
      var db, table;
      if (opts.DataSource.match(/^dbi:mysql:(\w+)(.*$)/)) {
        db = RegExp.$1;
        table = opts.TableName ? opts.TableName : 'sessions';
        this.config = {
          host: host,
          user: opts.UserName,
          password: opts.Password,
          database: db
        };
        MySQLSession.__super__.constructor.call(this, 'mysql', this.config);
      } else {
        console.log('Bad DataSource');
      }
    }

    return MySQLSession;

  })(DBISession);

  module.exports = MySQLSession;

}).call(this);
