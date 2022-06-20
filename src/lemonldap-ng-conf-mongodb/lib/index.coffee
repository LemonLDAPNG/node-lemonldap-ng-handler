###
# LemonLDAP::NG MongoDB configuration accessor for Node.js
#
# See README.md for license and copyright
###


class MongoConf
	constructor: (args) ->
		dbName = args.dbName or 'llConfDB'
		@colName = args.collectionName or 'configuration'

		# Build url
		url = "mongodb://#{args.host or '127.0.0.1'}:#{args.port or '27017'}/?"
		for name in ['host', 'auth_mechanism', 'auth_mechanism_properties', 'bson_codec', 'connect_timeout_ms', 'db_name', 'heartbeat_frequency_ms', 'j', 'local_threshold_ms', 'max_time_ms', 'password', 'port', 'read_pref_mode', 'read_pref_tag_sets', 'replica_set_name', 'server_selection_timeout_ms', 'server_selection_try_once', 'socket_check_interval_ms', 'socket_timeout_ms', 'ssl', 'username', 'w', 'wtimeout', 'read_concern_level']
			tmp = name.split('_')
			nam2 = tmp.shift()
			if tmp.length > 0
				for s in tmp
					nam2 += s[0].toUpperCase() + s.slice(1)
			opt = if args[name]? then args[name] else args[nam2]
			if opt?
				url += "#{nam2}=#{opt}&"
		url = url.replace /.$/, ''

		# Connect to MongoDB
		self = @
		mongodb = require('mongodb').MongoClient
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
