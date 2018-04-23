###
# LemonLDAP::NG super class for CDBI/RDBI
#
# See README.md for license and copyright
###


DBWrapper = require('node-dbi').DBWrapper
DBExpr = require('node-dbi').DBExpr
btype =
	SQLite: "sqlite3"
	Pg: "pg"
	mysql: "mysql"

convert =
	database: 'database'
	dbname:   'database'
	host:     'host'
	port:     'port'

class _dbiConf
	constructor: (args) ->
		if args.dbiChain.match /^dbi:(SQLite|Pg|mysql):(.*)/
			type = btype[RegExp.$1]
			dbiargs = RegExp.$2
			tmp = dbiargs.split /;/
			dbargs =
				user: args.dbiUser
				password: args.dbiPassword
			for t in tmp
				t2 = t.split /=/
				if t.match /=/
					if k = convert[t2[0]]
						dbargs[k] = t2[1]
			dbargs.path = dbargs.database if type == 'sqlite3'
			@db = new DBWrapper type, dbargs
			@table = if args.dbiTable then args.dbiTable else 'lmConfig'
			@db.connect()
		else
			console.error "Invalid dbiChain: #{args.dbiChain}"
			process.exit 1

	available: ->
		db = @connect()
		table = @table
		q = new Promise (resolve, reject) ->
			db.fetchCol "SELECT cfgNum FROM #{table} ORDER BY cfgNum", null, (err, res) ->
				if err
					console.log 'No conf found in database', err
					resolve []
				else
					resolve res
		q

	lastCfg: ->
		db = @connect()
		table = @table
		q = new Promise (resolve, reject) ->
			db.fetchOne "SELECT max(cfgNum) FROM #{table} ORDER BY cfgNum", [], (err, res) ->
				if err
					console.error err
					reject null
				else
					resolve res
		q

	lock: ->
		console.error 'TODO later'

	isLocked: ->
		console.error 'TODO later'

	unlock: ->
		console.error 'TODO later'

	delete: ->
		console.error 'TODO later'

	connect: () ->
		return @db if @db.isConnected()
		@db.connect()
		@db

module.exports = _dbiConf
