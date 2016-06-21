# TODO Reload mechanism, needed for cluster only:
# see file:///usr/share/doc/nodejs/api/cluster.html "Event 'message'"
exports.tsv =
	defaultCondition: {}
	defaultProtection: {}
	forgeHeaders: {}
	headerList: {}
	https: {}
	locationCondition: {}
	#locationConditionText: {}
	locationCount: {}
	locationProtection: {}
	locationRegexp: {}
	maintenance: {}
	port: {}
	portal: ''
	vhostAlias: {}
	vhostOptions: {}
exports.cfgNum = 0
exports.lmConf = {}
exports.localConfig = {}
exports.logLevel = 'notice'
exports.logLevels =
	emerg: 7
	alert: 6
	crit: 5
	error: 4
	warn: 3
	notice: 2
	info: 1
	debug:0
exports.sa = {}
exports.session = {}
exports.datas = {}
exports.datasUpdate = 0

exports.init = (args={}) ->
	exports.lmConf = require('./conf').init(args.configStorage)
	unless exports.lmConf
		# TODO: change msg in LlngConf
		console.log "Unable to build configuration"
		return null

	exports.localConfig = exports.lmConf.getLocalConf 'handler'
	exports.localConfig[i] = args[i] for i of args

	exports.checkTime = exports.localConfig.checkTime if exports.localConfig.checkTime

	# logLevel
	if exports.localConfig.logLevel
		if exports.logLevels[exports.localConfig.logLevel]?
			exports.localConfig.logLevel = exports.logLevels[exports.localConfig.logLevel]
		else
			console.log "Unknown log level '#{exports.localConfig.logLevel}'"

	# TODO: status

	# Load initial configuration
	exports.reload()
	exports

# Note that checkConf isn't needed: no shared cache with node.js
exports.checkConf = ->
	console.log "checkConf() must not be called"

exports.reload = ->
	conf = exports.lmConf.getConf()
	unless conf?
		console.log "Die"
		1/0

	# Default values initialization
	for w in ['cda', 'cookieExpiration', 'cipher', 'cookieName', 'customFunctions', 'httpOnly', 'securedCookie', 'timeoutActivity', 'useRedirectOnError', 'useRedirectOnForbidden', 'whatToTrace']
		exports.tsv[w] = conf[w]

	for w in ['https', 'port', 'maintenance']
		if conf[w]?
			exports.tsv[w] = {_: conf[w]}
			if conf.vhostOptions
				name = "vhost#{w.unFirst()}"
				for vhost, vConf of conf.vhostOptions
					val = vConf[name]
					# TODO: log
					exports.tsv[w][vhost] = val if val>0

	# Portal initialization
	unless conf.portal
		# TODO die
		1/0
	if conf.portal.match(/[\$\(&\|"']/)
		exports.tsv.portal = exports.conditionSub conf.portal
	else
		exports.tsv.portal = ->
			conf.portal

	# Location rules initialization
	for vhost, rules of conf.locationRules
		exports.tsv.locationCount[vhost] = 0
		for url, rule of rules
			[cond, prot] = exports.conditionSub rule
			if url == 'default'
				exports.tsv.defaultCondition[vhost] = cond
				exports.tsv.defaultProtection[vhost] = prot
			else
				exports.tsv.locationCondition[vhost] = [] unless exports.tsv.locationCondition[vhost]?
				exports.tsv.locationCondition[vhost].push cond
				exports.tsv.locationProtection[vhost] = [] unless exports.tsv.locationProtection[vhost]?
				exports.tsv.locationProtection[vhost].push prot
				exports.tsv.locationRegexp[vhost] = [] unless exports.tsv.locationRegexp[vhost]?
				exports.tsv.locationRegexp[vhost].push(new RegExp url.replace /\(\?#.*?\)/,'')
				exports.tsv.locationCount[vhost]++
		unless exports.tsv.defaultCondition[vhost]
			exports.tsv.defaultCondition[vhost] = () -> 1
			exports.tsv.defaultProtection = 0

	# Sessions storage initialization
	unless sessionStorageModule = conf.globalStorage.replace /^Apache::Session::/, ''
		#TODO: die "globalStorage required"
		1/0
	exports.sa = require("./#{sessionStorageModule.toLowerCase()}Session").init(conf.globalStorageOptions)

	# Headers initialization
	for vhost, headers of conf.exportedHeaders
		exports.tsv.headerList[vhost] = [] unless exports.tsv.headerList[vhost]?
		exports.tsv.headerList[vhost].push(a) for a of headers
		sub = ''
		for h,v of headers
			val = exports.substitute v
			sub += "'#{h}': #{val},"
		sub = sub.replace /,$/, ''
		eval "this.tsv.forgeHeaders['#{vhost}'] = function() {return {#{sub}};}"

	# TODO: post url initialization

	# Alias initialization
	for vhost,aliases of conf.vhostOptions
		if aliases
			t = aliases.split /\s+/
			for a in t
				exports.tsv.vhostAlias[a] = vhost
	1

exports.conditionSub = (cond) ->
	OK = -> 1
	NOK = -> 0
	return [OK, 0] if cond == 'accept'
	return [NOK, 0] if cond == 'deny'
	return [OK, 1] if cond == 'unprotect'
	return [OK, 2] if cond == 'skip'

	# TODO: manage app logout
	if cond.match /^logout(?:_sso|_app|_app_sso|)(?:\s+(.*))?$/i
		url = RegExp.$1
		if url
			return ->
				exports._logout = url
				0
		else
			return ->
				exports._logout = exports.tsv.portal()
				0
	cond = exports.substitute(cond)
	eval "sub = function() {return (#{cond});}"
	return [sub, 0]

exports.substitute = (expr) ->
	expr
	.replace /\$date\b/, 'this.date()'
	.replace /\$vhost\b/, 'this.hostname()'
	.replace /\$ip\b/, 'this.remote_ip()'
	.replace /\$(_*[a-zA-Z]\w*)/g, 'this.datas.$1'

exports.date = ->
	# TODO

exports.hostname = ->
	# TODO

remote_ip: ->
	# TODO

