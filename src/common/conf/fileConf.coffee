###
# LemonLDAP::NG file configuration accessor for Node.js/express
#
# See README.md for license and copyright
###

class fileConf
	fs: require 'fs'
	constructor: (args) ->
		unless @dirName = args.dirName
			console.log "'dirName' is required in 'File' configuration type ! \n"
			return null
		unless @fs.lstatSync(@dirName).isDirectory()
			console.log "Directory #{@dirName} doesn't exist\n"
			return null

	available: ->
		res = []
		for f in @fs.readdirSync(@dirName).sort()
			if f.match /lmConf-(\d+)\.js/
				res.push RegExp.$1
		res

	lastCfg: ->
		@available().pop()

	lock: ->
		@fs.appendFileSync @dirName+'/lmConf.lock', 'lock'

	isLocked: ->
		return @fs.statSync(@dirName+'/lmConf.lock').isFile()

	unlock: ->
		@fs.unlink @dirName+'/lmConf.lock'

	store: (fields) ->
		@fs.writeFileSync "#{@dirName}/lmConf-#{fields.cfgNum}.js", JSON.stringify(fields)
		return fields.cfgNum

	load: (cfgNum, fields) ->
		try
			@fs.accessSync "#{@dirName}/lmConf-#{cfgNum}.js", @fs.R_OK
		catch error
			console.log "Unable to read #{@dirName}/lmConf-#{cfgNum}.js (#{error})"
			return null
		data = @fs.readFileSync "#{@dirName}/lmConf-#{cfgNum}.js"
		try
			return JSON.parse data
		catch error
			console.log "JSON parsing error: #{error}"
			return null

	delete: (cfgNum) ->
		try
			@fs.accessSync "#{@dirName}/lmConf-#{cfgNum}.js", @fs.W_OK
		catch error
			console.log "Unable to access #{@dirName}/lmConf-#{cfgNum}.js (#{error})"
			return null
		@fs.unlink "#{@dirName}/lmConf-#{fields.cfgNum}.js"
		1

module.exports = fileConf
