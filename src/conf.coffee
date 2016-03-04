class LlngConf
	msg: ''
	constructor: (args) ->
		this[k] = args[k] for k of args
		lc = @getLocalConf 'configuration', @confFile, 0
		this[k] = lc[k] for k of lc
		unless @type.match /^[\w:]+$/
			@msg += "Error: configStorage: type is not well formed.\n"
		@module = new exports["#{@type}Conf"](this,this)
		return 0 unless @module
		@msg = @type + ' module loaded'

	getConf: (args) ->
		args.cfgNum or= @module.lastCfg
		unless args.cfgNum
			@msg += "No configuration available in backend.\n"
			return null
		r = @module.load args.cfgNum
		unless r
			@msg += "Get configuration #{args.cfgNum} failed\n"
			return null
		unless args.raw
			r.cipher = new LlngCrypto r.key
		r

	getLocalConf: (section,file,loadDefault=true) ->
		file = file ? (process.env.LLNG_DEFAULTCONFFILE ? '/etc/lemonldap-ng/lemonldap-ng.ini')
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


	saveConf: (conf, args) ->
		last = @module.lastCfg()
		unless args.force
			return -1 if conf.cfgNum != last
			return -3 if @module.isLocked() or not @module.lock()
		conf.cfgNum = last + 1 unless args.cfgNumFixed
		delete conf.cipher

		tmp = @module.store conf
		unless tmp > 0
			@msg += "Configuration #{conf.cfgNum} not stored\n"
			@module.unlock()
			return if tmp? then tmp else -2
		@msg += "Configuration #{conf.cfgNum} stored\n"
		@module.unlock() ? tmp : -2

a = new LlngConf
console.log a
