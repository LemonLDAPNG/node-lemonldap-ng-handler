###
# LemonLDAP::NG super class for CDBI/RDBI
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

class _dbiConf
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
			@table = if args.dbiTable then args.dbiTable else 'lmConfig'
		else
			console.error "Invalid dbiChain: #{args.dbiChain}"
			process.exit 1

	available: ->
		db = @connect()
		table = @table
		d = new Promise (resolve, reject) ->
			q = db.query "SELECT cfgNum FROM #{table} ORDER BY cfgNum"
			if q
				rc = q.count()
				t = []
				for i in [1 .. rc+1]
					q.seek i
					t.push q.value 1
				resolve t
			else
				console.log 'No conf found in database', err
				resolve []
		d

	lastCfg: ->
		db = @connect()
		table = @table
		d = new Promise (resolve, reject) ->
			q = db.query "SELECT max(cfgNum) FROM #{table} ORDER BY cfgNum"
			if q
				q.seek 1
				resolve q.value 1
			else
				console.log 'No conf found in database', err
				resolve []
		d

	lock: ->
		console.error 'TODO later'

	isLocked: ->
		console.error 'TODO later'

	unlock: ->
		console.error 'TODO later'

	delete: ->
		console.error 'TODO later'

	connect: () ->
		return @db if @db
		@db = DBWrapper.DBConnection @dbargs
		unless @db
			console.error 'Connection failed', @dbargs
			Error 'Unable to connect to database'
		@db

module.exports = _dbiConf
