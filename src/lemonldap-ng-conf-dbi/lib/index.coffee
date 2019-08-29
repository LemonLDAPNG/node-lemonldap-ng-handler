###
# LemonLDAP::NG super class for CDBI/RDBI
#
# See README.md for license and copyright
###


class _dbiConf
	constructor: (args) ->
			perlWrap = require 'perl-dbi'
			@db = new perlWrap(args)
			@table = if args.dbiTable then args.dbiTable else 'lmConfig'

	available: ->
		self = @
		db = @db.connect()
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
				self.logger.error 'No conf found in database'
				resolve []
		d

	lastCfg: ->
		db = @db.connect()
		table = @table
		d = new Promise (resolve, reject) ->
			q = db.query "SELECT max(cfgNum) FROM #{table} ORDER BY cfgNum"
			if q
				q.seek 1
				resolve q.value 1
			else
				self.logger.error 'No conf found in database'
				resolve []
		d

	lock: ->
		@logger.error 'TODO later'

	isLocked: ->
		@logger.error 'TODO later'

	unlock: ->
		@logger.error 'TODO later'

	delete: ->
		@logger.error 'TODO later'

module.exports = _dbiConf
