###
# LemonLDAP::NG CDBI configuration accessor for Node.js/express
#
# See README.md for license and copyright
###

'use strict'

_DBI = require './_dbiConf'

class cdbiConf extends _DBI
	load: (cfgNum, fields) ->
		self = @
		# TODO fields
		db = @db.connect()
		table = @table
		d = new Promise (resolve, reject) ->
			q = db.query "SELECT data FROM #{table} WHERE cfgNum=%1", [cfgNum]
			if q
				q.seek 1
				data = q.value 1
				try
					tmp = JSON.parse data
					resolve tmp
				catch err
					self.logger.error "Error when parsing session file (#{err})"
					reject err
			else
				self.logger.error "Conf #{cfgNum} not found: #{d.lastError()}"
				reject null
		d

	store: ->
		@logger.error 'TODO later'

module.exports = cdbiConf
