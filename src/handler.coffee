###
# LemonLDAP::NG handler for Node.js/express
#
# See README.md for license and copyright
###
conf = null

class Handler
	constructor: (args) ->
		m = require('./handlerConf')
		@conf = new m(args)

	run: (req, res, next) ->
		self = @
		vhost = req.headers.host
		uri = decodeURI req.url
		if @conf.tsv.maintenance[vhost]
			console.error "Go to portal with maintenance error code #{vhost}"
			return @setError res, '/', 503, 'Service Temporarily Unavailable'

		protection = @isUnprotected req, uri

		if protection == 'skip'
			return next()

		id = @fetchId(req)
		if id
			self.retrieveSession id
				.then (session) ->
					self.grant req, uri, session
						.then () ->
							# TODO: display uid
							console.log "Granted #{id}"
							self.sendHeaders req, session
							self.hideCookie req
							return next()
						.catch (e) ->
							console.log "#{id} rejected " + if e.message? then e.message
							self.forbidden req, res, session
				.catch (e) ->
					console.error e
					self.goToPortal res, 'http://' + vhost + uri
		else
			console.log "No id"
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
			for k of fcgiOtp
				fcgiOpt = options[k] if options[k]?
		# Define server
		srv = if fcgiOpt.mode == 'fcgi' then require('node-fastcgi') else require('http')
		srv.createServer (req, res) ->
			next = () ->
				console.log "Granted"
				res.writeHead 200, req.headers
			resp = self.run req, res, next
			if resp.then
				resp.then () ->
					res.end()
			else
				res.end()
		.listen fcgiOpt.port, fcgiOpt.ip
		console.log "Server started at " + fcgiOpt.ip + ":" + fcgiOpt.port

	grant: (req, uri, session) ->
		self = @
		d = new Promise (resolve,reject) ->
			vhost = self.resolveAlias req
			unless self.conf.tsv.defaultCondition[vhost]?
				console.error "No configuration found for #{vhost} (or not listed in Node.js virtualHosts)"
				return reject()
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
			console.error "No headers configuration found for #{vhost}"
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
						console.log "Session #{id} expired"
						reject false

					# Update the session to notify activity, if necessary
					if self.conf.tsv.timeoutActivity and now - session._lastSeen > 60
						session._lastSeen = now
						self.conf.sa.update id, session
					resolve session
				.catch () ->
					console.log "Session #{id} can't be found in store"
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
		urlc = @conf.tsv.portal()
		if uri
			urlc += '?url=' + new Buffer(encodeURI(uri)).toString('base64')
		if args
			urlc += if uri then '&' else '?'
			urlc += args

		# req.redirect is defined when running under express. If not
		# we are running as FastCGI server
		console.log "Redirecting to " + urlc
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
			u = "#{@conf.tsv.portal}/lmerror/#{code}?url=" + new Buffer(encodeURI(uri)).toString('base64')
			console.log "Redirecting to " + u
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
		h = new Handler(args)
	run: (req, res, next) ->
		h.run req, res, next
	nginxServer: (options) ->
		h.nginxServer options
	class: Handler
