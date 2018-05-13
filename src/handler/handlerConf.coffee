###
# LemonLDAP::NG handler initialization module for Node.js/express
#
# See README.md for license and copyright
###

# TODO Reload mechanism, needed for cluster only:
# see file:///usr/share/doc/nodejs/api/cluster.html "Event 'message'"

Iconv = null
cipher = null

class HandlerConf
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

		@localConfig = @lmConf.getLocalConf 'node-handler', null, 1
		@localConfig[i] = args[i] for i of args
		Logger = require './logger'
		@logger = new Logger @localConfig, 0
		@userLogger = new Logger @localConfig, 1
		@lmConf['logger'] = @logger

		@checkTime = @localConfig.checkTime if @localConfig.checkTime

		# TODO: status

		# Load initial configuration
		@reload()
		try
			Iconv = require('iconv').Iconv
		catch e
			@logger.notice "iconv module not available"

	# Note that checkConf isn't needed: no shared cache with node.js
	checkConf: ->
		@logger.error "checkConf() must not be called"

	# Configuration compilation
	#
	# Compile LLNG configuration for performances
	reload: ->
		self = this
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
							name = "vhost#{w.unFirst()}"
							for vhost, vConf of conf.vhostOptions
								val = vConf[name]
								# TODO: log
								self.tsv[w][vhost] = val if val>0

				# Portal initialization
				unless conf.portal
					# TODO die
					1/0
				if conf.portal.match(/[\$\(&\|"']/)
					self.tsv.portal = self.conditionSub conf.portal
				else
					self.tsv.portal = ->
						conf.portal

				# Location rules initialization
				for vhost, rules of conf.locationRules
					if vhostList.indexOf(vhost) != -1
						self.logger.debug "Compiling rules for #{vhost}"
						self.tsv.locationCount[vhost] = 0
						for url, rule of rules
							[cond, prot] = self.conditionSub rule
							if url == 'default'
								self.tsv.defaultCondition[vhost] = cond
								self.tsv.defaultProtection[vhost] = prot
							else
								self.tsv.locationCondition[vhost] = [] unless self.tsv.locationCondition[vhost]?
								self.tsv.locationCondition[vhost].push cond
								self.tsv.locationProtection[vhost] = [] unless self.tsv.locationProtection[vhost]?
								self.tsv.locationProtection[vhost].push prot
								self.tsv.locationRegexp[vhost] = [] unless self.tsv.locationRegexp[vhost]?
								self.tsv.locationRegexp[vhost].push(new RegExp url.replace /\(\?#.*?\)/,'')
								self.tsv.locationCount[vhost]++
						unless self.tsv.defaultCondition[vhost]
							self.tsv.defaultCondition[vhost] = () -> 1
							self.tsv.defaultProtection = false

				# Sessions storage initialization
				unless sessionStorageModule = conf.globalStorage.replace /^Apache::Session::(?:Browseable::)?/, ''
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
						eval "self.tsv.forgeHeaders['#{vhost}'] = function(session) {return {#{sub}};}"

				# TODO: post url initialization

				# Alias initialization
				for vhost,aliases of conf.vhostOptions
					if aliases
						t = aliases.split /\s+/
						for a in t
							self.tsv.vhostAlias[a] = vhost

				self.tsv['cookieDetect'] = new RegExp "\\b#{self.tsv.cookieName}=([^;]+)"

				1
			.catch (e) ->
				self.logger.error "Can't get configuration: #{e}"

	# Build expression into functions (used to control user access and build
	# headers)
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

	date = ->
		d = new Date()
		s = ''
		a = [ d.getFullYear(), d.getMonth()+1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds() ]
		for x in a
			s += if x<10 then "0#{x}" else "#{x}"
		return s

	hostname = (req) ->
		return req.headers.host

	remote_ip = (req) ->
		return if req.ip? then req.ip else req.cgiParams.REMOTE_ADDR

	basic = (login, pwd) ->
		return "Basic " + unicode2iso("#{login}:#{pwd}").toString('base64')

	groupMatch = (groups, attr, value) ->
		match = 0
		re = new RegExp value
		for group, v of groups
			if v[attr]?
				if typeof v[attr] == 'object'
					for s in v[attr]
						match++ if s.match re
				else
					match++ if v[attr].match re
		return match

	isInNet6 = (ip, net) ->
		test = require 'is-in-subnet'
		return test.isInSubnet ip, net

	checkLogonHours = (logonHours, syntax='hexadecimal', timeCorrection, defaultAccess=0) ->
		timeCorrection = parseInt timeCorrection
		d = new Date()
		hourPos = d.getDay() * 24 + d.getHours() + timeCorrection
		div = if syntax == 'octetstring' then 3 else 4
		pos = Math.trunc(hourPos/div)
		v1 = Math.pow(2,hourPos % div)
		v2 = logonHours.substr(pos,1)
		if v2.match /\d/
			v2 = parseInt v2 # Cast as int
		else
			v2 = v2.charCodeAt(0)
			v2 = if v2 > 70 then v2 - 87 else v2 - 55
		return v1 & v2

	checkDate = (start=0, end, defaultAccess=0) ->
		start = start + ''
		start = start.substring(0,14)
		end   = end + ''
		end   = end.substring(0,14)
		return defaultAccess unless start or end
		end or= 999999999999999
		d = date()
		return if (d >= start and d <= end) then true else false

	unicode2iso = (s) ->
		iconv = new Iconv('UTF-8', 'ISO-8859-1')
		return iconv.convert(s)

	iso2unicode = (s) ->
		iconv = new Iconv('ISO-8859-1', 'UTF-8')
		return iconv.convert(s)

	encrypt = (s) ->
		return cipher.encrypt s

	token = () ->
		time = Math.trunc Date.now()/1000 # Perl time
		args = Array.from arguments
		return encrypt "#{time}:#{args.join(':')}"

	encode_base64 = (s) ->
		r = new Buffer(s).toString('base64')

module.exports = HandlerConf
