DBISession = require './dbiSession'

class MySQLSession extends DBISession
	constructor: (opts) ->
		if opts.DataSource.match /^dbi:mysql:(\w+)(.*$)/
			db = RegExp.$1
			table = if opts.TableName then opts.TableName else 'sessions'
			@config =
				host: host
				user: opts.UserName
				password: opts.Password
				database: db
			super('mysql',@config)
		else
			console.log 'Bad DataSource'

module.exports = MySQLSession
