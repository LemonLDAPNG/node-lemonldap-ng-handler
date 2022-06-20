###
# LemonLDAP::NG handler-oauth2 for Node.js/express
# (see https://lemonldap-ng.org/documentation/2.0/servertoserver)
#
# See README.md for license and copyright
###

Handler = require('./').class

class HandlerOAuth2 extends Handler
	constructor: (args) ->
		self = super(args)
		self
		self

	fetchId: (req) ->
		authorization = req.cgiParams['HTTP_AUTHORIZATION']
		if authorization? and authorization.match /^Bearer (.+)$/i
			access_token = authorization.replace /^Bearer (.+)$/i, "$1"
			@logger.debug "Found OAuth2 access token #{access_token}"
			return access_token
		return super req

	retrieveSession: (access_token) ->
		self = @
		d = new Promise (resolve, reject) ->
			oidcSession = self.conf.oidcStorageModule.get id # kind OIDCI
				.then (session) ->
					if session.user_session_id
						super session.user_session_id
							.then (s) ->
								resolve s
							.catch (e) ->
								reject false
				.catch (e) ->
					self.userLogger.info "OAuth2 token not found in store: #{e}"
					reject false

module.exports = HandlerOAuth2
