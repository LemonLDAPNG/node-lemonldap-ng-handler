###
# Load chosen logger
###
module.exports = (conf, type) ->
	cl = (if type then conf.userLogger or conf.logger else conf.logger) or 'Std'
	cl = cl.replace /^Lemonldap::NG::Common::Logger::/i, ''
	try
		m = require "./#{cl}"
	catch
		m = require "lemonldap-ng-conf-#{cl/toLowerCase()}"
	return new m conf, type
