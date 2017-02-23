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
			console.log "Error: configStorage: type is not well formed.\n"
			return null
		try
			m = require("./#{@type.toLowerCase()}Conf")
			@module = new m(this)
		catch e
			console.log e
			return null
		console.log @type + ' module loaded'
		for k in ['available','lastCfg','lock','isLocked','unlock','store','load','delete']
			this[k] = @module[k]
		this

	getConf: (args={}) ->
		args.cfgNum or= @module.lastCfg()
		unless args.cfgNum
			console.log "No configuration available in backend.\n"
			return null
		r = @module.load args.cfgNum
		unless r
			console.log "Get configuration #{args.cfgNum} failed\n"
			return null
		unless args.raw
			m = require("./crypto")
			r.cipher = new m(r.key)
		r

	getLocalConf: (section,file,loadDefault=true) ->
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
			console.log "Configuration #{conf.cfgNum} not stored\n"
			@module.unlock()
			return if tmp? then tmp else -2
		console.log "Configuration #{conf.cfgNum} stored\n"
		return if @module.unlock() then tmp else -2

module.exports = conf
