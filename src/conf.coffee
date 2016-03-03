class LlngConf
	msg: ''
	constructor: (args) ->
		this[k] = args[k] for k of args
		lc = @getLocalConf 'configuration', @confFile, 0
		this[k] = lc[k] for k of lc
		unless @type.match /^[\w:]+$/
			@msg += "Error: configStorage: type is not well formed.\n"
		@module = @loadModule @type
		return 0 unless @.module.prereq()
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
		file = file ? (process.env.LLNG_DEFAULTCONFFILE ? '/etc/lemonldap-ng/lemoldap-ng.ini')
		iniparser = require('inireader').IniReader()
		localConf = iniparser.load file
		res = {}
		if loadDefaut
			for k of localConf.param 'all'
				res[k] = localConf.param 'all.' + k
		return res if section == 'all'

		for k of localConf.param section
			res[k] = localConf.param section + '.' + k
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

