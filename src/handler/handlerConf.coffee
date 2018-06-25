###
# LemonLDAP::NG handler initialization module
#
# See README.md for license and copyright
###

# TODO Reload mechanism, needed for cluster only:
# see file:///usr/share/doc/nodejs/api/cluster.html "Event 'message'"

cipher = null
sid = 0
ExtdFunc = require './safelib'

class HandlerConf
	newSafe: () ->
		safe = new ExtdFunc(@tsv.cipher)
		@vm.createContext safe
		return safe

	tsv:
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
	cfgNum: 0
	lmConf: {}
	localConfig: {}
	logLevel: 'notice'
	datas: {}
	datasUpdate: 0
	safe: {}

	# Initialization method
	#
	# Get local and global configuration
	constructor: (args={}) ->
		m = require './conf'
		@lmConf = new m(args.configStorage)
		unless @lmConf
			# TODO: change msg in LlngConf
			console.error "Unable to build configuration"
			return null


		@localConfig = @lmConf.getLocalConf 'node-handler', null, true
		@localConfig[i] = args[i] for i of args
		Logger = require './logger'
		@logger = new Logger @localConfig, 0
		@userLogger = new Logger @localConfig, 1
		@lmConf['logger'] = @logger

		@checkTime = @localConfig.checkTime if @localConfig.checkTime

		# TODO: status

		# Load initial configuration
		@reload()
		@vm = require 'vm'

	# Note that checkConf isn't needed: no shared cache with node.js
	checkConf: ->
		@logger.error "checkConf() must not be called"

	# Configuration compilation
	#
	# Compile LLNG configuration for performances
	reload: ->
		self = this
		unFirst = (s) ->
			return s.charAt(0).toUpperCase() + s.slice(1)
		@lmConf.getConf { logger: @logger }
			.then (conf) ->
				for k of self.localConfig
					conf[k] = self.localConfig[k]

				self.logger.debug "Virtualhosts configured for Node.js: #{conf.nodeVhosts}"
				vhostList = if conf.nodeVhosts then conf.nodeVhosts.split(/[,\s]+/) else []

				# Default values initialization
				for w in ['cda', 'cookieExpiration', 'cipher', 'cookieName', 'customFunctions', 'httpOnly', 'securedCookie', 'timeoutActivity', 'useRedirectOnError', 'useRedirectOnForbidden', 'whatToTrace', 'loopBackUrl']
					self.logger.debug "Conf key #{w}: #{conf[w]}" unless w == 'cipher'
					self.tsv[w] = conf[w]
				cipher = self.tsv.cipher

				for w in ['https', 'port', 'maintenance']
					if conf[w]?
						self.tsv[w] = { _: conf[w] }
						if conf.vhostOptions
							name = "vhost#{unFirst(w)}"
							for vhost, vConf of conf.vhostOptions
								val = vConf[name]
								# TODO: log
								self.tsv[w][vhost] = val if val>0

				# Portal initialization
				unless conf.portal
					# TODO die
					1/0
				if conf.portal.match(/[\$\(&\|"']/)
					self.tsv.portal = self.conditionSubs(conf.portal)[0]
				else
					self.tsv.portal = ->
						conf.portal

				# Location rules initialization
				for vhost, rules of conf.locationRules
					if vhostList.indexOf(vhost) != -1
						self.logger.debug "Compiling rules for #{vhost}"
						self.tsv.locationCount[vhost] = 0
						self.tsv.locationRegexp[vhost] = [] unless self.tsv.locationRegexp[vhost]?
						self.tsv.locationProtection[vhost] = [] unless self.tsv.locationProtection[vhost]?
						self.tsv.locationCondition[vhost] = [] unless self.tsv.locationCondition[vhost]?
						unless self.safe[vhost]?
							self.safe[vhost] = self.newSafe()
						for url, rule of rules
							[cond, prot] = self.conditionSub rule, self.safe[vhost]
							if url == 'default'
								self.tsv.defaultCondition[vhost] = cond
								self.tsv.defaultProtection[vhost] = prot
							else
								self.tsv.locationCondition[vhost].push cond
								self.tsv.locationProtection[vhost].push prot
								self.tsv.locationRegexp[vhost].push(new RegExp url.replace /\(\?#.*?\)/,'')
								self.tsv.locationCount[vhost]++
						unless self.tsv.defaultCondition[vhost]
							self.tsv.defaultCondition[vhost] = () -> 1
							self.tsv.defaultProtection = false

				# Sessions storage initialization
				sessionStorageModule = conf.globalStorage
				.replace(/^Lemonldap::NG::Common::Apache::Session::REST/,'rest')
				.replace(/^Apache::Session::(?:Browseable::)?/, '')
				if sessionStorageModule.match /Apache::Session/
					Error "Unsupported session backend: #{conf.globalStorage}"
				m = require './sessions'
				self.sa = new m sessionStorageModule, self.logger, conf.globalStorageOptions

				# Headers initialization
				for vhost, headers of conf.exportedHeaders
					if vhostList.indexOf(vhost) != -1
						self.logger.debug "Compiling headers for #{vhost}"
						self.tsv.headerList[vhost] = [] unless self.tsv.headerList[vhost]?
						self.tsv.headerList[vhost].push(a) for a of headers
						sub = ''
						for h,v of headers
							val = self.substitute v
							sub += "'#{h}': #{val},"
						sub = sub.replace /,$/, ''
						self.vm.runInContext "fg = function(session) {return {#{sub}};}", self.safe[vhost]
						self.tsv.forgeHeaders[vhost] = self.safe[vhost].fg

				# TODO: post url initialization

				# Alias initialization
				for vhost,v of conf.vhostOptions
					if v.aliases
						console.error 'aliases', v.aliases
						t = v.aliases.split /\s+/
						for a in t
							self.tsv.vhostAlias[a] = vhost

				self.tsv['cookieDetect'] = new RegExp "\\b#{self.tsv.cookieName}=([^;]+)"

				1
			.catch (e) ->
				self.logger.error "Can't get configuration: #{e}"

	# Build expression into functions (used to control user access and build
	# headers)
	conditionSub: (cond, ctx) ->
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
				return [
					(session) ->
						session._logout = url
						0
					0
				]
			else
				return [
					(session) ->
						session._logout = @tsv.portal()
						0
					0
				]
		cond = @substitute(cond)
		if ctx
			sid++
			@vm.runInContext "sub#{sid} = function(req,session) {return (#{cond});}", ctx
			return [ ctx["sub#{sid}"], 0 ]
		else
			sub = null
			eval "sub = function(req,session) {return (#{cond});}"
			return [sub, 0]

	# Interpolate expressions
	substitute: (expr) ->
		expr

		# Special macros
		.replace /\$date\b/g, 'this.date()'
		.replace /\$vhost\b/g, 'this.hostname(req)'
		.replace /\$ip\b/g, 'this.remote_ip(req)'

		# Session attributes: $xx is replaced by session.xx
		.replace /\$(_*[a-zA-Z]\w*)/g, 'session.$1'


module.exports = HandlerConf
