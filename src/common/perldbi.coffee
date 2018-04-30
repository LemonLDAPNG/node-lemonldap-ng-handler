###
# Perl style DBI wrapper
#
# See README.md for license and copyright
###

DBWrapper = require('nodedbi')
btype =
	SQLite: "sqlite3"
	Pg: "pg"
	mysql: "mysql"

convert =
	database: 'dbname'
	dbname:   'dbname'
	host:     'host'
	port:     'port'
	encoding: 'encoding'

class PerlDBI
	constructor: (args) ->
		if args.dbiChain.match /^dbi:(SQLite|Pg|mysql):(.*)/
			type = btype[RegExp.$1]
			unless type
				Error "Unsupported database type: #{RegExp.$1}"
			tmp = RegExp.$2.split /;/
			@dbargs =
				type: type
			for t in tmp
				if t2 = t.match /^(.*?)=(.*)$/
					if k = convert[t2[1]]
						@dbargs[k] = t2[2]
			if type == 'sqlite3'
				if @dbargs.dbname.match /^(.*)[\\\/](.*?)$/
					@dbargs.dbname = RegExp.$2
					@dbargs.sqlite3_dbdir = RegExp.$1
				else
					@dbargs.sqlite3_dbdir = '.'
			else
				@dbargs.user     = args.dbiUser
				@dbargs.password = args.dbiPassword
			@connect()
		else
			console.error "Invalid dbiChain: #{args.dbiChain}"
			process.exit 1
	connect: () ->
		return @db if @db
		@db = DBWrapper.DBConnection @dbargs
		unless @db
			console.error 'Connection failed', @dbargs
			Error 'Unable to connect to database'
		@db

module.exports = PerlDBI
