class exports.LlngHandlerConf
	tsv: {}
	cfgNum: 0
	lmConf: {}
	localConfig: {}
	logLevel: 'notice'
	logLevels:
		emerg: 7
		alert: 6
		crit: 5
		error: 4
		warn: 3
		notice: 2
		info: 1
		debug:0
	session: {}
	datas: {}
	datasUpdate: 0

	init: (args) ->
		# TODO: local cache ?
		#args.configStorage[i] or= args[i] for i in ['localStorage', 'localStorageOptions']
		@lmConf = new LlngConf(args.configStorage)
		unless @lmConf
			# TODO: change msg in LlngConf
			console.log "Unable to build configuration: #{LlngConf.msg}"

		@localConfig = @lmConf.getLocalConf 'handler'
		@localConfig[i] = args[i] for i in args

		@checkTime = @localConfig.checkTime if @localConfig.checkTime

		# logLevel
		if @localConfig.logLevel
			if@logLevels[@localConfig.logLevel]
				@localConfig.logLevel = @logLevels[@localConfig.logLevel]
			else
				console.log "Unknown log level '#{@localConfig.logLevel}'"

		# TODO: status

		# Load initial configuration
		@reload()
	
	# Note that checkConf isn't needed: no shared cache with node.js
	checkConf: ->
		console.log "checkConf() must not be called"

	reload: ->
		conf = @lmConf.getConf()
		@configReload conf

		# Default values initialization
		for w in ['cda', 'cookieExpiration', 'cookieName', 'customFunctions', 'httpOnly', 'securedCookie', 'timeoutActivity', 'useRedirectOnError', 'useRedirectOnForbidden', 'whatToTrace']
			@tsv[w] = conf[w]

		@tsv.cipher = new LlngCrypto(conf.key)

		for w in ['https', 'port', 'maintenance']
			if @conf[w]?
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
		if @conf.portal.match(/[\$\(&\|"']/)
			@tsv.portal = @conditionSub @conf.portal
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
					@tsv.locationCondition[vhost].push cond
					@tsv.locationProtection[vhost].push prot
					@tsv.locationRegexp[vhost].push(new RegExp(url))
					@tsv.locationConditionText[vhost].push(if cond.match(/^\(\?#(.*?)\)/) then RegExp.$1 else if cond.match(/^(.*?)##(.+)$/) then RegExp.$2 else url)
					@tsv.locationCount[vhost]++
			unless @tsv.defaultCondition[vhost]
				@tsv.defaultCondition[vhost] = () -> 1
				@tsv.defaultProtection = 0

		# Sessions storage initialization
		unless @tsv.sessionStorageModule = conf.globalStorage
			#TODO: die "globalStorage required"
			1/0
		@tsv.sessionStorageOptions = @conf.globalStorageOptions

		# Headers initialization
		for vhost, headers of conf.exportedHeaders
			@tsv.headerList[vhost].push(a) for a of headers
			sub = ''
			for h,v of headers
				val = @substitute v
				sub += "'#{k}': #{val},"
			sub = sub.replace /,$/, ''
			@tsv.forgeHeaders[vhost] = reval "function() {return {#{sub}};}"

		# TODO: post url initialization

		# Alias initialization
		for vhost,aliases of conf.vhostOptions
			if aliases
				t = aliases.split /\s+/
				for a in t
					@tsv.vhostAlias[a] = vhost
		1

	conditionSub: (cond) ->
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
		# TODO: interpolate cond
		sub = reval "function() {return {#{cond}};}"
		return [sub, 0]

	substitute: (expr) ->
		expr
		.replace /\$date\b/, 'this.date()'
		.replace /\$vhost\b/, 'this.hostname()'
		.replace /\$ip\b/, 'this.remote_ip()'
		.replace /\$(_*[a-zA-Z]\w*)/g, 'this.datas.$1'

	date: ->
		# TODO
	
	hostname: ->
		# TODO

	remote_ip: ->
		# TODO
