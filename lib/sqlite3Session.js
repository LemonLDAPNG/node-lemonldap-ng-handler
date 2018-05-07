(function() {
  var DBISession, SQLite3Session;

  DBISession = require('./dbiSession');

  SQLite3Session = class SQLite3Session extends DBISession {
    constructor(logger, opts) {
      var config;
      if (opts.DataSource) {
        // get opts
        config = {
          dbiChain: opts.DataSource
        };
        super('sqlite3', logger, config);
      } else {
        logger.error('Bad DataSource');
      }
    }

  };

  module.exports = SQLite3Session;

}).call(this);
