http  = require 'http'
https = require 'https'
require 'llngconf'

class llngHandler
	constructor: ->
		@confObj = new LemonldapConf

exports.handler = new llngHandler
