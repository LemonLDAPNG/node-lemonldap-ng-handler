###
# LemonLDAP::NG CDBI configuration accessor for Node.js/express
#
# See README.md for license and copyright
###

_DBI = require './_dbiConf'

class cdbiConf extends _DBI
	load: (cfgNum, fields) ->
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
					console.error "Error when parsing session file (#{err})"
					reject err
			else
				console.error "Conf #{cfgNum} not found", d.lastError()
				reject null
		d

	store: ->
		console.error 'TODO later'

module.exports = cdbiConf
