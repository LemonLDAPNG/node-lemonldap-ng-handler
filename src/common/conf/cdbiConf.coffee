###
# LemonLDAP::NG CDBI configuration accessor for Node.js/express
#
# See README.md for license and copyright
###

_DBI = require './_dbiConf'

class cdbiConf extends _DBI
	load: (cfgNum, fields) ->
		# TODO fields
		db = @connect()
		table = @table
		q = new Promise (resolve, reject) ->
			db.fetchRow "SELECT data FROM #{table} WHERE cfgNum=?", [cfgNum], (err, res) ->
				if err
					console.error err
					reject null
				else
					try
						tmp = JSON.parse res.data
						resolve tmp
					catch err
						console.error "Error when parsing session file (#{err})"
						reject err
		q

	store: ->
		console.error 'TODO later'

module.exports = cdbiConf
