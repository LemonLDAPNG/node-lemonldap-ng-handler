###
# LemonLDAP::NG CDBI configuration accessor for Node.js/express
#
# See README.md for license and copyright
###

_DBI = require './_dbiConf'
constants = require './confConstants'

class rdbiConf extends _DBI
	load: (cfgNum, fields) ->
		self = @
		# TODO fields
		db = @connect()
		table = @table
		q = new Promise (resolve, reject) ->
			db.fetchAll "SELECT field,value FROM #{table} WHERE cfgNum=?", [cfgNum], (err, res) ->
				if err
					console.error err
					reject null
				else
					try
						cfg = {}
						for row in res
							cfg[row.field] = row.value
						console.log 'COUCOU', cfg
						resolve self.unserialize cfg
					catch err
						console.error "Error when parsing configuration (#{err})"
						reject err
		q

	store: ->
		console.error 'TODO later'

	unserialize: (cfg) ->
		res = {}
		for k,v of cfg
			if k.match constants.hashParameters
				try
					res[k] = JSON.parse v
				catch err
					Error "Error when parsing #{k} field: (#{err})"
			else
				res[k] = v
		return res

module.exports = rdbiConf
