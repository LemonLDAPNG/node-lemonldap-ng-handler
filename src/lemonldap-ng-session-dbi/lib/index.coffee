###
# LemonLDAP::NG DBI session accessor for Node.js/express
#
# See README.md for license and copyright
###

class DBISession
	constructor: (@eng, @logger, @config) ->
		perlWrap = require 'perl-dbi'
		@db = new perlWrap(@config)
		@config.table or= 'sessions'

	# get(): Recover session data
	get: (id) ->
		self = @
		db = @db.connect()
		table = @config.table
		d = new Promise (resolve, reject) ->
			q = db.query "SELECT a_session FROM #{table} WHERE id=%1", [id]
			if q
				if q.count() == 1
					q.seek 1
					try
						tmp = JSON.parse q.value 1
						resolve tmp
					catch err
						self.logger.error "Error when parsing session file (#{err})", res
						reject err
				else
					self.logger.info "Session #{id} expired"
					reject false
			else
				self.logger.error "Unable to query database"
				reject false
		d

	update: (id, data) ->
		db = @db.connect()
		table = @config.table
		d = new Promise (resolve, reject) ->
			tmp =
				id: id
				a_session: JSON.stringify data
			#db.insert table, tmp, (err) ->
			#	if err
			#		reject err
			#	else
			#		resolve true
		d

module.exports = DBISession
