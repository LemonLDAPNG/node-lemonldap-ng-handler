###
# LemonLDAP::NG handler for Node.js/express
#
# See README.md for license and copyright
###

Handler = require('./handler').class

class HandlerServiceToken extends Handler
	constructor: (args) ->
		super(args)

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
				console.error 'Bad service token'
				return false

			# Is token in good interval ?
			time = Date.now()/1000
			unless t[0] <= time and t[0] > time - 30
				console.error 'Expired service token'
				return false

			# Is vhost listed in token ?
			vh = @resolveAlias req
			unless t.indexOf(vh) >1
				console.error "#{vh} not authorizated in token (#{s})"
				return false

			# Retun _session_id
			return t[1]

		super(req)

module.exports = HandlerServiceToken
