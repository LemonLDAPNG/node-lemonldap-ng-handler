'use strict'

DBISession = require './dbiSession'

class SQLite3Session extends DBISession
	constructor: (logger,opts) ->
		if opts.DataSource
			# get opts
			config =
				dbiChain: opts.DataSource
			super 'sqlite3', logger, config
		else
			logger.error 'Bad DataSource'

module.exports = SQLite3Session
