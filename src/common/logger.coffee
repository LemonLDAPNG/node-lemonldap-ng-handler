###
# Load chosen logger
###
module.exports = (conf, type) ->
	cl = (if type then conf.userLogger or conf.logger else conf.logger) or 'Std'
	cl = 'logger' + cl.replace /^Lemonldap::NG::Common::Logger::/i, ''
	m = require "./#{cl}"
	return new m conf, type
