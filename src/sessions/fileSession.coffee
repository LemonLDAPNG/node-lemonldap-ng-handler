###
# LemonLDAP::NG file session accessor for Node.js/express
#
# See README.md for license and copyright
###
exports.fs = require 'fs'
exports.directory = '/tmp'

# Initialization:
# verify that directory exists
exports.init = (opts={}) ->
	exports.directory = opts.Directory if opts.Directory
	state = exports.fs.statSync exports.directory
	unless state.isDirectory()
		console.log "#{exports.directory} isn't usable to manage File sessions"
		process.exit(1)
	exports

# get(): Recover session data
#
# Note that it fails only on JSON parsing: if session doesn't exists, it just
# return a false value
exports.get = (id) ->
	datas = {}
	return new Promise (resolve, reject) ->
		exports.fs.readFile "#{exports.directory}/#{id}", 'utf-8', (err, data) ->
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

exports.update = (id, data) ->
	return new Promise (resolve, reject) ->
		exports.fs.writeFile "#{exports.directory}/#{id}", 'utf-8', JSON.stringify data, (err,data) ->
			if err
				reject err
			else
				resolve data
