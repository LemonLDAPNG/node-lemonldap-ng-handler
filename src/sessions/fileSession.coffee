exports.fs = require 'fs'
exports.directory = '/tmp'

exports.init = (opts={}) ->
	exports.directory = opts.Directory if opts.Directory
	exports

exports.get = (id) ->
	datas = {}
	try
		return JSON.parse @fs.readFileSync "#{@directory}/#{id}"
	catch error
		console.log error
		return null

exports.update = (id, data) ->
	try
		return @fs.writeFileSync "#{@directory}/#{id}", JSON.stringify data
	catch error
		console.log error
		return 0

