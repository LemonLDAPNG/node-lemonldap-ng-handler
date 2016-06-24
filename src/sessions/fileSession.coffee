###
# LemonLDAP::NG file session accessor for Node.js/express
#
# See README.md for license and copyright
###
exports.fs = require 'fs'
exports.directory = '/tmp'

exports.init = (opts={}) ->
	exports.directory = opts.Directory if opts.Directory
	exports

exports.get = (id) ->
	datas = {}
	return new Promise (resolve, reject) ->
		exports.fs.readFile "#{exports.directory}/#{id}", (err, data) ->
			if err
				console.log err
				resolve false
			else
				resolve data

exports.update = (id, data) ->
	return new Promise (resolve, reject) ->
		exports.fs.writeFile "#{exports.directory}/#{id}", JSON.stringify data, (err,data) ->
			if err
				reject err
			else
				resolve data

