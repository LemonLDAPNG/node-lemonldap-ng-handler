###
#
###

class sessions

	constructor: (type, opts={}) ->
		try
			m = require "./#{type.toLowerCase()}Session"
			@backend = new m opts
			@newCache(opts)
		catch err
			console.log "Unable to load #{type} session backend: #{err}"
			process.exit 1
		this

	newCache: (args={}) ->
		fileCache = require('file-cache-simple')
		# Cache timeout is set to 10 mn
		args.cacheExpire = 600000
		args.cacheDir or= '/tmp/llng'
		args.prefix = 'llng'
		@localCache = new fileCache(args)

	get: (id) ->
		return new Promise (resolve, reject) ->
			try
				@localCache.get(id).then (lsession) ->
					if lsession?
						resolve lsession
					else
						@backend.get(id).then (session) ->
							console.log "Download session #{id}"
							@localCache.set id, session
							resolve session
						, (err) ->
							reject err
			catch err
				console.log "Local cache error", err
				reject err

# Update session: update both central and local DB and return only central DB
# value
	update: (id, data) ->
		return new Promise (resolve, reject) ->
			Promise.all [
				@backend id, data
				@localCache.set id, data
			]
			.then (v) ->
				resolve v[0]
			, (err) ->
				console.log "Session update", err
				reject err

module.exports = sessions
