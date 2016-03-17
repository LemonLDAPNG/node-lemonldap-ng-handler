class FileSessionReader
	fs: require 'fs'
	directory: '/tmp'

	constructor: (opts) ->
		@directory = opts.Directory if opts.Directory

	get: (id) ->
		datas = {}
		try
			return JSON.parse @fs.readFileSync "#{@directory}/#{id}"
		catch error
			console.log error
			return null

	update: (id, data) ->
		try
			return @fs.writeFileSync "#{@directory}/#{id}", JSON.stringify data
		catch error
			console.log error
			return 0

exports.FileSessionReader = FileSessionReader
