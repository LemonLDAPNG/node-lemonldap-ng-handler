###
# LemonLDAP::NG file session accessor for Node.js/express
#
# See README.md for license and copyright
###

fs = require 'fs'
class session
	directory: '/tmp'

	# Initialization:
	# verify that directory exists
	constructor: (opts) ->
		@directory = opts.Directory if opts.Directory
		state = fs.statSync @directory
		unless state.isDirectory()
			console.log "#{@directory} isn't usable to manage File sessions"
			process.exit 1
		this

	# get(): Recover session data
	#
	# Note that it fails only on JSON parsing: if session doesn't exists, it just
	# return a false value
	get: (id) ->
		dir = @directory
		q = new Promise (resolve, reject) ->
			fs.readFile "#{dir}/#{id}", 'utf-8', (err, data) ->
				if err
					console.log err
					resolve false
				else
					try
						tmp = JSON.parse data
						resolve tmp
					catch err
						console.log "Error when parsing session file (#{err})"
						reject err
		q

	update: (id, data) ->
		dir = @directory
		return new Promise (resolve, reject) ->
			fs.writeFile "#{dir}/#{id}", 'utf-8', JSON.stringify data, (err,data) ->
				if err
					reject err
				else
					resolve data

module.exports = session
