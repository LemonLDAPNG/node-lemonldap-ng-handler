###
# LemonLDAP::NG handler-service-token for Node.js/express
# (see https://lemonldap-ng.org/documentation/2.0/servertoserver)
#
# See README.md for license and copyright
###

Handler = require('./').class

class HandlerServiceToken extends Handler
	constructor: (args) ->
		super(args)

	# Override fetchId() to use token if present instead of cookie
	fetchId: (req) ->
		token = ''
		if req.cgiParams
			token = req.cgiParams['HTTP_X_LLNG_TOKEN']
		else
			token = req.header['x-llng-token']

		if token
			# Decrypt token
			s = @conf.tsv.cipher.decrypt token

			# Token format:
			# time:_session_id:vhost1:vhost2,...
			t = s.split ':'

			# At least one vhost
			unless t[2]
				@userLogger.error 'Bad service token'
				return false

			# Is token in good interval ?
			time = Date.now()/1000
			unless t[0] <= time and t[0] > time - 30
				@userLogger.warn 'Expired service token'
				return false

			# Is vhost listed in token ?
			vh = @resolveAlias req
			unless t.indexOf(vh) >1
				@userLogger.error "#{vh} not authorizated in token (#{s})"
				return false

			# Retun _session_id
			return t[1]

		super(req)

module.exports = HandlerServiceToken
