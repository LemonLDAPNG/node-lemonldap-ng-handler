###
# LemonLDAP::NG handler for Node.js/express
#
# See README.md for license and copyright
###
conf = null

class Handler
	constructor: (args) ->
		m = require('./conf')
		@conf = new m(args)
		@logger = @conf.logger
		@userLogger = @conf.userLogger

	run: (req, res, next) ->
		self = @
		vhost = req.headers.host
		uri = decodeURI req.url
		if @conf.tsv.maintenance[vhost]
			self.logger.info "Go to portal with maintenance error code #{vhost}"
			return @setError res, '/', 503, 'Service Temporarily Unavailable'

		protection = @isUnprotected req, uri

		# Skip value is 2
		if protection == 2
			next()
			return new Promise (resolve,reject) ->
				resolve true

		id = @fetchId(req)
		if id
			self.retrieveSession id
				.then (session) ->
					self.grant req, uri, session
						.then () ->
							# TODO: display uid
							self.userLogger.info "User #{session[self.conf.tsv.whatToTrace]} was granted to access to #{uri}"
							self.sendHeaders req, session
							self.hideCookie req
							return next()
						.catch (e) ->
							self.userLogger.warn "#{session[self.conf.tsv.whatToTrace]} rejected: " + if e? then (if e.message? then e.message else e) else ''
							self.forbidden req, res, session
				.catch (e) ->
					self.logger.info "Session error: #{e}"
					self.goToPortal res, 'http://' + vhost + uri
		else
			self.logger.debug "No id"
			u = "://#{vhost}#{uri}"
			if @conf.tsv.https? and @conf.tsv.https[vhost]
				u = "https#{u}"
			else
				u = "http#{u}"
			@goToPortal res, u

	nginxServer: (options) ->
		self = @
		fcgiOpt =
			mode: "fcgi"
			port: 9090
			ip: 'localhost'

		if options?
			for k of fcgiOpt
				fcgiOpt[k] = options[k] if options[k]?
		# Define server
		srv = if fcgiOpt.mode == 'fcgi' then require('node-fastcgi') else require('http')
		srv.createServer (req, res) ->
			next = () ->
				res.writeHead 200, req.headers
			resp = self.run req, res, next
			if resp.then
				resp.then () ->
					res.end()
			else
				res.end()
		.listen fcgiOpt.port, fcgiOpt.ip
		self.logger.info "Server started at " + fcgiOpt.ip + ":" + fcgiOpt.port

	grant: (req, uri, session) ->
		self = @
		d = new Promise (resolve,reject) ->
			vhost = self.resolveAlias req
			unless self.conf.tsv.defaultCondition[vhost]?
				self.logger.error "No configuration found for #{vhost} (or not listed in Node.js virtualHosts)"
				return reject()
			self.conf.tsv.locationRegexp[vhost] = [] unless self.conf.tsv.locationRegexp[vhost]?
			for rule,i in self.conf.tsv.locationRegexp[vhost]
				if uri.match rule
					return resolve self.conf.tsv.locationCondition[vhost][i](req,session)
			if self.conf.tsv.defaultCondition[vhost](req,session)
				resolve()
			else
				reject()
		d

	forbidden: (req, res, session) ->
		uri = req.uri
		u = session._logout
		if u
			return @goToPortal res, u, 'logout=1'
		# req.redirect is defined when running under express. If not
		# we are running as FastCGI server
		@setError res, '/', 403, 'Forbidden'

	sendHeaders: (req, session) ->
		vhost = @resolveAlias req
		try
			i=0
			req.headers['Lm-Remote-User'] = session[@conf.tsv.whatToTrace]
			for k,v of @conf.tsv.forgeHeaders[vhost](session)
				i++
				req.headers[k] = v
				req.rawHeaders.push k, v

				# req.redirect is defined when running under express. If not
				# we are running as FastCGI server
				unless req.redirect?
					req.headers["Headername#{i}"] = k
					req.headers["Headervalue#{i}"] = v
		catch err
			@logger.warn "No headers configuration found for #{vhost}: #{err}"
		true

	resolveAlias: (req) ->
		vhost = req.headers.host.replace /:.*$/, ''
		return @conf.tsv.vhostAlias[vhost] || vhost

	# Get cookie value
	fetchId: (req) ->
		if req.headers.cookie
			cor = @conf.tsv.cookieDetect.exec req.headers.cookie
			if cor and cor[1] != '0'
				return cor[1]
		else
			return false

	# Get session from store
	retrieveSession: (id) ->
		self = @
		d = new Promise (resolve, reject) ->
			self.conf.sa.get id
				.then (session) ->
					# Timestamp in seconds
					now = Date.now()/1000 | 0
					if now - session._utime > self.conf.tsv.timeout or ( self.conf.tsv.timeoutActivity and session._lastSeen and now - $session._lastSeen > self.conf.tsv.timeoutActivity )
						self.userLogger.info "Session #{id} expired"
						reject false

					# Update the session to notify activity, if necessary
					if self.conf.tsv.timeoutActivity and now - session._lastSeen > 60
						session._lastSeen = now
						self.conf.sa.update id, session
					resolve session
				.catch (e) ->
					self.userLogger.info "Session #{id} can't be found in store: #{e}"
					reject false
		d

	# Check if uri is protected
	isUnprotected: (req, uri) ->
		vhost = @resolveAlias req
		unless @conf.tsv.defaultCondition[vhost]?
			return false
		for rule,i in @conf.tsv.locationRegexp[vhost]
			if uri.match rule
				return @conf.tsv.locationProtection[vhost][i]
		return @conf.tsv.defaultProtection[vhost]

	# Remove LLNG cookie from headers
	hideCookie: (req) ->
		req.headers.cookie = req.headers.cookie.replace @conf.tsv.cookieDetect, ''

	goToPortal: (res, uri, args) ->
		unless typeof @conf.tsv.portal == 'function'
			console.error "Configuration is not ready"
			if res.redirect
				res.status 503
				.send 'Waiting for configuration'
			else
				res.writeHead 503
				res.end()
			return res
		urlc = @conf.tsv.portal()
		if uri
			urlc += '?url=' + new Buffer(encodeURI(uri)).toString('base64')
		if args
			urlc += if uri then '&' else '?'
			urlc += args

		# req.redirect is defined when running under express. If not
		# we are running as FastCGI server
		@logger.debug "Redirecting to " + urlc
		if res.redirect
			res.redirect urlc
		else
			# Nginx doesn't accept 302 from a auth request. LLNG Nginx configuration
			# maps 401 to 302 when "Location" is set
			res.writeHead 401,
				Location: urlc
		res

	setError: (res, uri, code, txt) ->
		if @conf.tsv.useRedirectOnError
			u = @conf.tsv.portal() + "?lmError=#{code}&url=" + new Buffer(encodeURI(uri)).toString('base64')
			@logger.debug "Redirecting to #{u}"
			if res.redirect?
				res.redirect u
			else
				# Nginx doesn't accept 302 from a auth request. LLNG Nginx configuration
				# maps 401 to 302 when "Location" is set
				res.writeHead 401,
					Location: u
		else
			if res.redirect?
				res.status(code).send txt
			else
				res.writeHead code, txt

h = {}

module.exports =
	init: (args) ->
		if args.type
			try
				h = require('./handler' + args.type)
				return h = new h(args)
			catch err
				console.error "Unable to load #{args.type} handler: #{err}"
		h = new Handler(args)
	run: (req, res, next) ->
		h.run req, res, next
	nginxServer: (options) ->
		h.nginxServer options
	class: Handler
