###
# LemonLDAP::NG REST configuration accessor for Node.js
#
# See README.md for license and copyright
###

'use strict'

class restConf
	constructor: (@args) ->
		unless @args.baseUrl
			Error "url parameter is required in REST configuration type"
		unless @args.baseUrl.match /(https?):\/\/([^\/:]+)(?::(\d+))?(.*)/
			Error "Bad URL #{@args.baseUrl}"
		@host = RegExp.$2
		@port = RegExp.$3 or if RegExp.$1 == 'https' then 443 else 80
		@path = RegExp.$4 or '/'
		@http = require RegExp.$1

	available: ->
		d = new Promise (resolve, reject) ->
			reject 'Not implemented for now'
		d

	lastCfg: ->
		d = new Promise (resolve, reject) ->
			@get 'latest'
			.then (res) ->
				resolve res
			.catch (e) ->
				reject e
		d

	load: (cfgNum, fields) ->
		self = this
		d = new Promise (resolve, reject) ->
			@get "#{cfgNum}?full=1"
			.then (res) ->
				resolve res
			.catch (e) ->
				reject e
		d

	get: (path) ->
		opt =
			host: @host
			port: @port
			path: @path + path
		if @args.user
			opt.headers =
				Authorization: "Basic " + Buffer.from("#{@args.user}:#{@args.password}").toString('base64')
		d = new Promise (resolve, reject) ->
			req = @http.request opts, (resp) ->
				str = ''
				resp.on 'data', (chunk) ->
					str += chunk
				resp.on 'end', () ->
					if str
						res = ''
						try
							json = JSON.parse str
							resolve json
						catch err
							reject "JSON parsing error: #{err}"
					else
						reject "No response received"
		d

module.exports = restConf
