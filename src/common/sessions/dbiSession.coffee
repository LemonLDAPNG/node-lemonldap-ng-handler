###
# LemonLDAP::NG DBI session accessor for Node.js/express
#
# See README.md for license and copyright
###

DBWrapper = require('node-dbi').DBWrapper

class DBISession
	constructor: (@eng, @config) ->
		@db = new DBWrapper(@eng, @config)
		@config.table or= 'sessions'
		@connect()

	# get(): Recover session data
	get: (id) ->
		db = @connect()
		table = @config.table
		q = new Promise (resolve, reject) ->
			db.fetchRow "SELECT * FROM #{table} WHERE id=?", [id], (err, res) ->
				if err
					console.log err
					resolve false
				else
					try
						tmp = JSON.parse data.a_session
						resolve tmp
					catch err
						console.log "Error when parsing session file (#{err})"
						reject err
		q

	update: (id, data) ->
		db = @connect()
		table = @config.table
		q = new Promise (resolve, reject) ->
			tmp =
				id: id
				a_session: JSON.stringify data
			db.insert table, tmp, (err) ->
				if err
					reject err
				else
					resolve true

	connect: () ->
		return @db if @db.isConnected()
		@db.connect()
		@db

module.exports = DBISession
