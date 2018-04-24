DBISession = require './dbiSession'

convert =
	database: 'database'
	dbname:   'database'
	host:     'host'
	port:     'port'

class PgSession extends DBISession
	constructor: (opts) ->
		if opts.DataSource.match /^dbi:Pg:(.*$)/
			dbiargs = RegExp.$1
			table = if opts.TableName then opts.TableName else 'sessions'
			tmp = dbiargs.split /;/
			dbargs =
				user: opts.UserName
				password: opts.Password
			for t in tmp
				if t.match /=/
					t2 = t.split /=/
					if k = convert[t2[0]]
						dbargs[k] = t2[1]
				else
					dbargs.database = t
			super('pg', dbargs)
		else
			console.error 'Bad DataSource'

module.exports = PgSession
