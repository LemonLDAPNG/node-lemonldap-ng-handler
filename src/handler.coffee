###
# LemonLDAP::NG handler for Node.js/express
#
# See README.md for license and copyright
###
conf          = null
cookieDetect  = null

class handler
	constructor: (args) ->
		m = require('./handlerConf')
		conf          = new m(args)
		cookieDetect  = new RegExp "\\b#{conf.tsv.cookieName}=([^;]+)"

	run: (req, res, next) ->
		vhost = req.headers.host
		# TODO: detect https
		uri = decodeURI req.url
		if conf.tsv.maintenance[vhost]
			# TODO
			console.log 'TODO'

		# CDA: TODO
		if conf.tsv.cda and uri.replace(new RegExp("[\\?&;](#{cn}(http)?=\\w+)$",'','i'))
			str = RegExp.$1
			# TODO redirect with cookie

		protection = isUnprotected req, uri

		if protection == 'skip'
			# TODO: verify this
			return next()

		id = fetchId(req)
		if id
			retrieveSession(id).then (session) ->
				unless session
					goToPortal res, 'http://' + vhost + uri
				else
					unless grant req, uri, session
						forbidden req, res, session
					else
						sendHeaders req, session
						hideCookie req
		else
			goToPortal res, 'http://' + vhost + uri

	grant = (req, uri, session) ->
		vhost = resolveAlias req
		unless conf.tsv.defaultCondition[vhost]?
			console.log "No configuration found for #{vhost}"
			return false
		for rule,i in conf.tsv.locationRegexp[vhost]
			if uri.match rule
				return conf.tsv.locationCondition[vhost][i](session)
		return conf.tsv.defaultCondition[vhost](session)

	forbidden = (req, res, session) ->
		uri = req.uri
		u = session._logout
		if u
			return goToPortal res, u, 'logout=1'
		res.status(403).send 'Forbidden'

	sendHeaders = (req, session) ->
		vhost = resolveAlias req
		try
			for k,v of conf.tsv.forgeHeaders[vhost](session)
				req.headers[k] = v
				req.rawHeaders.push k, v
		catch err
			console.log "No headers configuration found for #{vhost}"
		true

	goToPortal = (res, uri, args) ->
		urlc = conf.tsv.portal()
		if uri
			urlc += '?url=' + new Buffer(encodeURI(uri)).toString('base64')
		if args
			urlc += if uri then '&' else '?'
			urlc += args
		res.redirect urlc

	resolveAlias = (req) ->
		vhost = req.headers.host.replace /:.*$/, ''
		return conf.tsv.vhostAlias[vhost] || vhost

	# Get cookie value
	fetchId = (req) ->
		if req.headers.cookie
			cor = cookieDetect.exec req.headers.cookie
			if cor and cor[1] != '0'
				return cor[1]
		else
			return false

	# Get session from store
	retrieveSession = (id) ->
		d = new Promise (resolve, reject) ->
			conf.sa.get(id).then (session) ->
				unless session
					console.log "Session #{id} can't be found in store"
					resolve false
				# Timestamp in seconds
				now = Date.now()/1000 | 0
				if now - session._utime > conf.tsv.timeout or ( conf.tsv.timeoutActivity and session._lastSeen and now - $session._lastSeen > conf.tsv.timeoutActivity )
					console.log "Session #{id} expired"
					resolve false

				# Update the session to notify activity, if necessary
				if conf.tsv.timeoutActivity and now - session._lastSeen > 60
					session._lastSeen = now
					conf.sa.update id, session
				resolve session
			.catch () ->
				resolve false
		d

	# Check if uri is protected
	isUnprotected = (req, uri) ->
		vhost = resolveAlias req
		unless conf.tsv.defaultCondition[vhost]?
			return false
		for rule,i in conf.tsv.locationRegexp[vhost]
			if uri.match rule
				return conf.tsv.locationProtection[vhost][i]
		return conf.tsv.defaultProtection[vhost]

	# Remove LLNG cookie from headers
	hideCookie = (req) ->
		req.headers.cookie = req.headers.cookie.replace cookieDetect, ''

h = {}

module.exports =
	init: (args) ->
		h = new handler(args)
	run: (req, res, next) ->
		h.run req, res, next
