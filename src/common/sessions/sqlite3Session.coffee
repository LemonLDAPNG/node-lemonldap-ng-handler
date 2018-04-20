DBISession = require './dbiSession'

class SQLite3Session extends DBISession
	constructor: (opts) ->
		if opts.DataSource.match /^dbi:SQLite:.*dbname=([\w\-\.\/]+)(.*$)/
			db = RegExp.$1
			#tmp = RegExp.$2
			table = if opts.TableName then opts.TableName else 'sessions'
			# get opts
			@config =
				path: db
			super 'sqlite3', @config
		else
			console.error 'Bad DataSource'

module.exports = SQLite3Session
