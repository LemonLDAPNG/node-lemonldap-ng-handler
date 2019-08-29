###
# LemonLDAP::NG CDBI configuration accessor for Node.js/express
#
# See README.md for license and copyright
###

_DBI = require 'lemonldap-ng-conf-dbi'
constants = require './confConstants'

class rdbiConf extends _DBI
	load: (cfgNum, fields) ->
		self = @
		# TODO fields
		db = @db.connect()
		table = @table
		d = new Promise (resolve, reject) ->
			# TODO: change this to dc.query
			db.fetchAll "SELECT field,value FROM #{table} WHERE cfgNum=?", [cfgNum], (err, res) ->
				if err
					self.logger.error err
					reject null
				else
					try
						cfg = {}
						for row in res
							cfg[row.field] = row.value
						resolve self.unserialize cfg
					catch err
						self.logger.error "Error when parsing configuration (#{err})"
						reject err
		d

	store: ->
		self.logger.error 'TODO later'

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
