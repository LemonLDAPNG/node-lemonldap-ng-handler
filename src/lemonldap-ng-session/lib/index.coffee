###
# Session access object
###

localCache = {}
backend = {}
class sessions

	constructor: (type, logger, opts={}) ->
		try
			m = require "./#{type.toLowerCase()}"
		catch e
			try
				m = require "lemonldap-ng-session-#{type.toLowerCase()}"
			catch err
				console.error "Unable to find #{type} session backend: #{err}"
				process.exit 1
		try
			backend = new m logger, opts
			@logger = logger
			newCache(opts)
		catch err
			console.error "Unable to load #{type} session backend: #{err}"
			process.exit 1

	get: (id) ->
		self = @
		return new Promise (resolve, reject) ->
			localCache.get id
				.then (lsession) ->
					if lsession
						resolve lsession
					else
						backend.get id
							.then (session) ->
								self.logger.debug "Download session #{id}"
								localCache.set id, session
								resolve session
							.catch (e) ->
								reject e
				.catch (e) ->
					self.logger.error "localCache error: #{e}"
					reject e

    # Update session: update both central and local DB and return only central
	# DB value
	update: (id, data) ->
		self = @
		return new Promise (resolve, reject) ->
			Promise.all [
				backend id, data
				localCache.set id, data
			]
				.then (v) ->
					resolve v[0]
				.catch (e) ->
					self.logger.error "Session update error: #{e}"
					reject e

	newCache = (args={}) ->
		fileCache = require('file-cache-simple')
		# Cache timeout is set to 10 mn
		args.cacheExpire = 600000
		args.cacheDir or= '/tmp/llng'
		args.prefix = 'llng'
		localCache = new fileCache(args)


module.exports = sessions
