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

exports.constructor = (args={}) ->
	@lmConf = new LlngConf(args.configStorage)
	unless @lmConf
		# TODO: change msg in LlngConf
		console.log "Unable to build configuration: #{LlngConfmsg}"
		return null

	@localConfig = @lmConf.getLocalConf 'handler'
	@localConfig[i] = args[i] for i of args

	@checkTime = @localConfig.checkTime if @localConfig.checkTime

	# logLevel
	if @localConfig.logLevel
		if @logLevels[@localConfig.logLevel]?
			@localConfig.logLevel = @logLevels[@localConfig.logLevel]
		else
			console.log "Unknown log level '#{@localConfig.logLevel}'"

	# TODO: status

	# Load initial configuration
	@reload()

# Note that checkConf isn't needed: no shared cache with node.js
exports.checkConf = ->
	console.log "checkConf() must not be called"

exports.reload = ->
	conf = @lmConf.getConf()
	unless conf?
		console.log "Die"
		1/0

	# Default values initialization
	for w in ['cda', 'cookieExpiration', 'cookieName', 'customFunctions', 'httpOnly', 'securedCookie', 'timeoutActivity', 'useRedirectOnError', 'useRedirectOnForbidden', 'whatToTrace']
		@tsv[w] = conf[w]

	@tsv.cipher = new LlngCrypto(conf.key)

	for w in ['https', 'port', 'maintenance']
		if conf[w]?
			@tsv[w] = {_: conf[w]}
			if conf.vhostOptions
				name = "vhost#{w.unFirst()}"
				for vhost, vConf of conf.vhostOptions
					val = vConf[name]
					# TODO: log
					@tsv[w][vhost] = val if val>0

	# Portal initialization
	unless conf.portal
		# TODO die
		1/0
	if conf.portal.match(/[\$\(&\|"']/)
		@tsv.portal = @conditionSub conf.portal
	else
		@tsv.portal = ->
			conf.portal

	# Location rules initialization
	for vhost, rules of conf.locationRules
		@tsv.locationCount[vhost] = 0
		for url, rule of rules
			[cond, prot] = @conditionSub rule
			if url == 'default'
				@tsv.defaultCondition[vhost] = cond
				@tsv.defaultProtection[vhost] = prot
			else
				@tsv.locationCondition[vhost] = [] unless @tsv.locationCondition[vhost]?
				@tsv.locationCondition[vhost].push cond
				@tsv.locationProtection[vhost] = [] unless @tsv.locationProtection[vhost]?
				@tsv.locationProtection[vhost].push prot
				@tsv.locationRegexp[vhost] = [] unless @tsv.locationRegexp[vhost]?
				@tsv.locationRegexp[vhost].push(new RegExp url.replace /\(\?#.*?\)/,'')
				@tsv.locationCount[vhost]++
		unless @tsv.defaultCondition[vhost]
			@tsv.defaultCondition[vhost] = () -> 1
			@tsv.defaultProtection = 0

	# Sessions storage initialization
	unless sessionStorageModule = conf.globalStorage.replace /^Apache::Session::/, ''
		#TODO: die "globalStorage required"
		1/0
	@sa = new exports["#{sessionStorageModule}SessionReader"](conf.globalStorageOptions)

	# Headers initialization
	for vhost, headers of conf.exportedHeaders
		@tsv.headerList[vhost] = [] unless @tsv.headerList[vhost]?
		@tsv.headerList[vhost].push(a) for a of headers
		sub = ''
		for h,v of headers
			val = @substitute v
			sub += "'#{h}': #{val},"
		sub = sub.replace /,$/, ''
		eval "this.tsv.forgeHeaders['#{vhost}'] = function() {return {#{sub}};}"

	# TODO: post url initialization

	# Alias initialization
	for vhost,aliases of conf.vhostOptions
		if aliases
			t = aliases.split /\s+/
			for a in t
				@tsv.vhostAlias[a] = vhost
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
				exports._logout = @tsv.portal()
				0
	cond = @substitute(cond)
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

