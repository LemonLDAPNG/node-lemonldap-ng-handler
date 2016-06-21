###
# LemonLDAP::NG file configuration accessor for Node.js/express
#
# See README.md for license and copyright
###
exports.fs = require 'fs'
exports.init = (args) ->
	unless exports.dirName = args.dirName
		console.log "'dirName' is required in 'File' configuration type ! \n"
		return null
	unless exports.fs.lstatSync(exports.dirName).isDirectory()
		console.log "Directory #{exports.dirName} doesn't exist\n"
		return null
	exports

exports.available = ->
	res = []
	for f in exports.fs.readdirSync(exports.dirName).sort()
		if f.match /lmConf-(\d+)\.js/
			res.push RegExp.$1
	res

exports.lastCfg = ->
	exports.available().pop()

exports.lock = ->
	exports.fs.appendFileSync exports.dirName+'/lmConf.lock', 'lock'

exports.isLocked = ->
	return exports.fs.statSync(exports.dirName+'/lmConf.lock').isFile()

exports.unlock = ->
	exports.fs.unlink exports.dirName+'/lmConf.lock'

exports.store = (fields) ->
	exports.fs.writeFileSync "#{exports.dirName}/lmConf-#{fields.cfgNum}.js", JSON.stringify(fields)
	return fields.cfgNum

exports.load = (cfgNum, fields) ->
	try
		exports.fs.accessSync "#{exports.dirName}/lmConf-#{cfgNum}.js", exports.fs.R_OK
	catch error
		console.log "Unable to read #{exports.dirName}/lmConf-#{cfgNum}.js (#{error})"
		return null
	data = exports.fs.readFileSync "#{exports.dirName}/lmConf-#{cfgNum}.js"
	try
		return JSON.parse data
	catch error
		console.log "JSON parsing error: #{error}"
		return null

exports.delete = (cfgNum) ->
	try
		exports.fs.accessSync "#{exports.dirName}/lmConf-#{cfgNum}.js", exports.fs.W_OK
	catch error
		console.log "Unable to access #{exports.dirName}/lmConf-#{cfgNum}.js (#{error})"
		return null
	exports.fs.unlink "#{exports.dirName}/lmConf-#{fields.cfgNum}.js"
	1

