###
# LemonLDAP::NG file session accessor for Node.js/express
#
# See README.md for license and copyright
###

fs = require 'fs'
class fileSession
	directory: '/tmp'

	# Initialization:
	# verify that directory exists
	constructor: (@logger, opts) ->
		@directory = opts.Directory if opts.Directory
		state = fs.statSync @directory
		unless state.isDirectory()
			Error "#{@directory} isn't usable to manage File sessions"
		this

	# get(): Recover session data
	#
	# Note that it fails only on JSON parsing: if session doesn't exists, it just
	# return a false value
	get: (id) ->
		self = @
		dir = @directory
		q = new Promise (resolve, reject) ->
			fs.readFile "#{dir}/#{id}", 'utf-8', (err, data) ->
				if err
					self.logger.info err
					resolve false
				else
					try
						tmp = JSON.parse data
						resolve tmp
					catch err
						reject "Error when parsing session file (#{err})"
		q

	update: (id, data) ->
		dir = @directory
		return new Promise (resolve, reject) ->
			fs.writeFile "#{dir}/#{id}", 'utf-8', JSON.stringify data, (err,data) ->
				if err
					reject err
				else
					resolve data

module.exports = fileSession
