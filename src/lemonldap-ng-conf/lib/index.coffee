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
			m = require "./lib/#{@type.toLowerCase()}"
			@module = new m(this)
		catch e
			try
				m = require "lemonldap-ng-conf-#{@type.toLowerCase()}"
				@module = new m(this)
			catch e
				console.error e
				return null
		#for k in ['available','lastCfg','lock','isLocked','unlock','store','load','delete']
		#	this[k] = @module[k]

	getConf: (args={}) ->
		self = @
		mod = @module
		d = new Promise (resolve,reject) ->
			mod.lastCfg()
				.then (cn) ->
					args.cfgNum or= cn
					unless args.cfgNum
						reject "No configuration available in backend.\n"
					mod.load args.cfgNum
						.then (r) ->
							unless args.raw
								m = require("./crypto")
								r.cipher = new m(r.key)
							self.logger.debug "Configuration #{args.cfgNum} loaded"
							resolve r
						.catch (e) ->
							self.logger.error "Get configuration #{args.cfgNum} failed\n", e
							reject null
				.catch (e) ->
					self.logger.error "No last cfg: #{e}"
		d

	getLocalConf: (section,file,loadDefault=false) ->
		file = file or @confFile
		iniparser = require('inireader').IniReader()
		iniparser.load file
		res = {}
		if loadDefault
			for k,v of iniparser.param 'all'
				res[k] = v

		for k,v  of iniparser.param section
			res[k] = v

		for k,v of res
			if v.match /^\s*\{/
				v = v.replace(/(\w+)\s*=>/g, '"$1":').replace(/:\s*'([^']+)'/g, ':"$1"')
				res[k] = JSON.parse v
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
			@logger.error "Configuration #{conf.cfgNum} not stored\n"
			@module.unlock()
			return if tmp? then tmp else -2
		@logger.info "Configuration #{conf.cfgNum} stored\n"
		return if @module.unlock() then tmp else -2

module.exports = conf
