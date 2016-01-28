###
# node-lemonldap-ng-handler
#
# Lemonldap::NG handler for node.js
#
# Copyright © 2016, Xavier Guimard <x.guimard@free.fr>
#
# See LICENSE file
###

http  = require 'http'
https = require 'https'
require 'llngconf'

class LLNGHandler
	constructor: (arg) ->
		@confObj = args.conf ? new LemonldapConf()

exports.llnghandler = new LLNGHandler
