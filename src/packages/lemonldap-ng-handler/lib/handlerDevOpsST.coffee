###
# LemonLDAP::NG handler-service-token for Node.js/express
# (see https://lemonldap-ng.org/documentation/2.0/servertoserver)
#
# See README.md for license and copyright
###

HandlerServiceToken = require './handlerServiceToken'

HandlerDevOps = require './handlerDevOps'

class HandlerDevOpsST extends HandlerDevOps
	fetchId: (req) ->
		return HandlerServiceToken::fetchId.call this, req

module.exports = HandlerDevOpsST
