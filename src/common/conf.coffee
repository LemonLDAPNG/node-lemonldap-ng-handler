###
# LemonLDAP::NG configuration accessor for Node.js/express
#
# See README.md for license and copyright
###

class conf

	module: null
	confFile: process.env.LLNG_DEFAULTCONFFILE or '/etc/lemonldap-ng/lemonldap-ng.ini'
	type: null

	constructor: (args={}) ->
		this[k] = args[k] for k of args
		lc = @getLocalConf 'configuration', @confFile, 0
		this[k] = lc[k] for k of lc
		unless @type.match /^[\w:]+$/
			console.error "Error: configStorage: type is not well formed.\n"
			return null
		try
			m = require("./#{@type.toLowerCase()}Conf")
			@module = new m(this)
		catch e
			console.error e
			return null
		console.log @type + ' module loaded'
		#for k in ['available','lastCfg','lock','isLocked','unlock','store','load','delete']
		#	this[k] = @module[k]

	getConf: (args={}) ->
		mod = @module
		d = new Promise (resolve,reject) ->
			mod.lastCfg()
				.then (cn) ->
					args.cfgNum or= cn
					unless args.cfgNum
						console.error "No configuration available in backend.\n"
						reject null
					mod.load args.cfgNum
						.then (r) ->
							unless args.raw
								m = require("./crypto")
								r.cipher = new m(r.key)
							console.log "Configuration #{args.cfgNum} loaded"
							resolve r
						.catch (e) ->
							console.error "Get configuration #{args.cfgNum} failed\n", e
							reject null
				.catch (e) ->
					console.error 'No last cfg', e
		d

	getLocalConf: (section,file,loadDefault=false) ->
		file = file or @confFile
		iniparser = require('inireader').IniReader()
		iniparser.load file
		res = {}
		if loadDefault
			for k,v of iniparser.param 'all'
				res[k] = v
		return res if section == 'all'

		for k,v  of iniparser.param section
			res[k] = v
		res

	saveConf: (conf, args={}) ->
		last = @module.lastCfg()
		unless args.force
			return -1 if conf.cfgNum != last
			return -3 if @module.isLocked() or not @module.lock()
		conf.cfgNum = last + 1 unless args.cfgNumFixed
		delete conf.cipher

		tmp = @module.store conf
		unless tmp > 0
			console.error "Configuration #{conf.cfgNum} not stored\n"
			@module.unlock()
			return if tmp? then tmp else -2
		console.log "Configuration #{conf.cfgNum} stored\n"
		return if @module.unlock() then tmp else -2

module.exports = conf
