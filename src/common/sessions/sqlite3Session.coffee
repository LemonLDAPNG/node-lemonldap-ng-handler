DBISession = require './dbiSession'

class SQLite3Session extends DBISession
	constructor: (opts) ->
		if opts.DataSource
			@table = if opts.TableName then opts.TableName else 'sessions'
			# get opts
			@config =
				dbiChain: opts.DataSource
			super 'sqlite3', @config
		else
			console.error 'Bad DataSource'

module.exports = SQLite3Session
