exports.module = null
exports.confFile = process.env.LLNG_DEFAULTCONFFILE or '/etc/lemonldap-ng/lemonldap-ng.ini'
exports.type = null

exports.init = (args={}) ->
	exports[k] = args[k] for k of args
	lc = exports.getLocalConf 'configuration', exports.confFile, 0
	exports[k] = lc[k] for k of lc
	unless exports.type.match /^[\w:]+$/
		console.log "Error: configStorage: type is not well formed.\n"
		return null
	try
		exports.module = require("./#{exports.type}Conf").init(exports)
	catch e
		console.log e
		return null
	console.log exports.type + ' module loaded'
	exports

exports.getConf = (args={}) ->
	args.cfgNum or= exports.module.lastCfg()
	unless args.cfgNum
		console.log "No configuration available in backend.\n"
		return null
	r = exports.module.load args.cfgNum
	unless r
		console.log "Get configuration #{args.cfgNum} failed\n"
		return null
	unless args.raw
		r.cipher = require("./crypto").init(r.key)
	r

exports.getLocalConf = (section,file,loadDefault=true) ->
	file = file or exports.confFile
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

exports.saveConf = (conf, args={}) ->
	last = exports.module.lastCfg()
	unless args.force
		return -1 if conf.cfgNum != last
		return -3 if exports.module.isLocked() or not exports.module.lock()
	conf.cfgNum = last + 1 unless args.cfgNumFixed
	delete conf.cipher

	tmp = exports.module.store conf
	unless tmp > 0
		console.log "Configuration #{conf.cfgNum} not stored\n"
		exports.module.unlock()
		return if tmp? then tmp else -2
	console.log "Configuration #{conf.cfgNum} stored\n"
	return if exports.module.unlock() then tmp else -2

for k in ['available','lastCfg','lock','isLocked','unlock','store','load','delete']
	exports[k] = exports.module[k]
