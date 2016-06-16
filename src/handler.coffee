conf = null

exports.init = (args) ->
	conf = new LlngHandlerConf(args)
	exports

exports.run = (req, res, next) ->
	# TODO
	vhost = req.hostname
	uri = req.uri
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
		return goToPortal uri

grant = (req) ->
	vhost = @resolveAlias()
	unless conf.tsv.defaultCondition[vhost]?
		console.log "No configuration found for #{vhost}"
		return false
	for rule,i in conf.tsv.locationRegexp[vhost]
		if uri.match rule
			return conf.tsv.locationCondition[vhost][i]()
	return conf.tsv.defaultCondition[vhost]

forbidden = (req) ->
	uri = req.uri
	# TODO: @datas must not be declared in LlngHandlerConf
	if u = @datas._logout
		return @goToPortal u, 'logout=1'
	# TODO
	return 403

sendHeaders = (res,req,next) ->

goToPortal = (uri, args) ->

resolveAlias = ->

fetchId = (req) ->

retrieveSession = (id) ->

isUnprotected = (uri) ->
