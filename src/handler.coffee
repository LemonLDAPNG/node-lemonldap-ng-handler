conf = null

exports.init = (args) ->
	conf = require('./handlerConf').init(args)
	exports

exports.run = (req, res, next) ->
	# TODO
	vhost = req.hostname
	# TODO: detect https
	uri = 'http://' + req.headers.host + req.url
	if conf.tsv.maintenance[vhost]
		# TODO
		console.log 'TODO'

	# CDA
	if conf.tsv.cda and uri.replace(new RegExp("[\?&;](#{cn}(http)?=\w+)$",'','i'))
		str = RegExp.$1
		# TODO redirect with cookie

	protection = isUnprotected(uri)

	if protection == 'skip'
		# TODO: verify this
		return next

	# TODO: get cookie
	if id = fetchId(req) and retrieveSession(id)
		return forbidden(req) unless grant(req)
		sendHeaders(req,res,next)
		return next

	else if protection == 'unprotect'
		# TODO: status, log ?
		return next

	else
		return goToPortal res, uri

grant = (req) ->
	vhost = resolveAlias()
	unless conf.tsv.defaultCondition[vhost]?
		console.log "No configuration found for #{vhost}"
		return false
	for rule,i in conf.tsv.locationRegexp[vhost]
		if uri.match rule
			return conf.tsv.locationCondition[vhost][i]()
	return conf.tsv.defaultCondition[vhost]

forbidden = (req) ->
	uri = req.uri
	if u = conf.datas._logout
		return goToPortal res, u, 'logout=1'
	# TODO
	return 403

sendHeaders = (req, res, next) ->

goToPortal = (res, uri, args) ->
	urlc = conf.tsv.portal()
	if uri
		urlc += '?url=' + new Buffer(uri).toString('base64')
	if args
		urlc += if uri then '&' else '?'
		urlc += args
	res.redirect urlc

resolveAlias = ->

fetchId = (req) ->

retrieveSession = (id) ->

isUnprotected = (uri) ->
