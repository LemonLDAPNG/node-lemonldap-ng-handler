###
# LemonLDAP::NG YAML file configuration accessor for Node.js
#
# See README.md for license and copyright
###

fs   = require 'fs'

###
# LemonLDAP::NG file configuration accessor for Node.js
#
# See README.md for license and copyright
###

fs = require 'fs'

class fileConf
	constructor: (args) ->
		unless @dirName = args.dirName
			console.error "'dirName' is required in 'File' configuration type ! \n"
			return null
		unless fs.lstatSync(@dirName).isDirectory()
			console.error "Directory #{@dirName} doesn't exist\n"
			return null

	available: ->
		dir = @dirName
		q = new Promise (resolve, reject) ->
			fs.readdir dir, (err, files) ->
				if err
					reject err
				else
					res = []
					for f in files
						if f.match /lmConf-(\d+)\.js/
							res.push RegExp.$1
					res.sort (a,b) ->
						a = parseInt(a,10)
						b = parseInt(b,10)
						return if a==b then 0 else if a<b then -1 else 1
					resolve res
		q

	lastCfg: ->
		self = this
		q = new Promise (resolve, reject) ->
			self.available()
				.then (av) ->
					resolve av.pop()
				.catch (err) ->
					reject err
		q

	#lock: ->
	#	fs.appendFileSync @dirName+'/lmConf.lock', 'lock'

	#isLocked: ->
	#	return fs.statSync(@dirName+'/lmConf.lock').isFile()

	#unlock: ->
	#	fs.unlink @dirName+'/lmConf.lock'

	#store: (fields) ->
	#	fs.writeFileSync "#{@dirName}/lmConf-#{fields.cfgNum}.js", JSON.stringify(fields)
	#	return fields.cfgNum

	load: (cfgNum, fields) ->
		self = this
		q = new Promise (resolve, reject) ->
			fs.access "#{self.dirName}/lmConf-#{cfgNum}.json",fs.R_OK, (err) ->
				if err
					reject "Unable to read #{self.dirName}/lmConf-#{cfgNum}.js (#{err})"
				else
					yaml = require 'js-yaml'
					fs.readFile "#{self.dirName}/lmConf-#{cfgNum}.json", (err, data) ->
						if err
							reject "Unable to read #{self.dirName}/lmConf-#{cfgNum}.js (#{err})"
						else
							try
								resolve yaml.safeLoad data
							catch err
								reject "YAML parsing error: #{err}"

module.exports = fileConf
