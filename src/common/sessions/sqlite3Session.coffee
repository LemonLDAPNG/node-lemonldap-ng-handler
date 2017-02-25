DBISession = require 'dbiSession'

class SQLite3Session extends DBISession
	constructor: (opts) ->
		if opts.DataSource.match /^dbi:SQLite:.*(dbname=[\w\-\.\/]+)(.*$)/
			db = RegExp.$1
			tmp = $2
			table = if opts.TableName then opts.TableName else 'Sessions'
			# get opts
			@config =
				database: db
			super('sqlite3',@config)
		else
			console.log 'Bad DataSource'

module.exports = SQLite3Session
