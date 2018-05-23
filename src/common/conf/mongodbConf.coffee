###
# LemonLDAP::NG MongoDB configuration accessor for Node.js
#
# See README.md for license and copyright
###

mongodb = require('mongodb').MongoClient

class MongoConf
	constructor: (args) ->
		dbName = args.dbName or 'llConfDB'
		@colName = args.collectionName or 'configuration'
		url = "mongodb://#{args.host or '127.0.0.1'}:#{args.port or '27017'}"
		self = @
		mongodb.connect(url).then (client) ->
			self.db = client.db(dbName)
			self.col = self.db.collection(self.colName)
		.catch (err) ->
			Error err

	available: ->
		self = this
		return new Promise (resolve, reject) ->
			self.db.command { distinct: self.colName, key: '_id' }
			.then (res) ->
				res = res.values
				res.sort (a,b) ->
					a = parseInt(a,10)
					b = parseInt(b,10)
					return if a==b then 0 else if a<b then -1 else 1
				resolve res
			.catch (err) ->
				reject err

	lastCfg: ->
		self = this
		return new Promise (resolve, reject) ->
			self.available().then (res) ->
				resolve res.pop()
			.catch (err) ->
				reject err

	load: (cfgNum, fields) ->
		self = this
		return new Promise (resolve, reject) ->
			self.col.findOne({_id: cfgNum.toString()})
			.then (res) ->
				for k,v of res
					if v.match? and v.match /^{/
						res[k] = JSON.parse v
				resolve res
			.catch (err) ->
				reject err

module.exports = MongoConf
