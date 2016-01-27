http  = require 'http'
https = require 'https'
require 'llngconf'

class LLNGHandler
	constructor: (arg) ->
		@confObj = args.conf ? new LemonldapConf()

exports.llnghandler = new LLNGHandler
