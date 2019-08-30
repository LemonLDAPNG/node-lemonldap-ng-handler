###
# LemonLDAP::NG Redis session accessor for Node.js/express
#
# See README.md for license and copyright
###

redis = require 'redis'

class RedisSession
	constructor: (@logger, opts) ->
		port = 0
		unless opts.server
			Error "server is required for Redis backend"
		if opts.server.match /(.*?):(\d+)/
			opts.server = RegExp.$1
			port        = RegExp.$2
		else
			port = 6379
		@client = redis.createClient port, opts.server

	get: (id) ->
		self = @
		console.log 'GET', id
		q = new Promise (resolve, reject) ->
			self.client.get id, (error, buffer) ->
				if error
					reject error
				else
					try
						tmp = JSON.parse buffer
						resolve tmp
					catch e
						console.log e
						reject e
		q

	update: (id,data) ->

module.exports = RedisSession
