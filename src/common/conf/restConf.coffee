###
# LemonLDAP::NG REST configuration accessor for Node.js
#
# See README.md for license and copyright
###

class restConf
	constructor: (@args) ->
		unless @args.baseUrl
			Error "baseUrl parameter is required in REST configuration type"
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
		self = @
		d = new Promise (resolve, reject) ->
			self.get 'latest'
			.then (res) ->
				resolve res.cfgNum
			.catch (e) ->
				reject e
		d

	load: (cfgNum, fields) ->
		self = this
		d = new Promise (resolve, reject) ->
			self.get "#{cfgNum}?full=1"
			.then (res) ->
				resolve res
			.catch (e) ->
				reject e
		d

	get: (path) ->
		self = @
		opt =
			host: @host
			port: @port
			path: @path + path
		if @args.user
			opt.headers =
				Authorization: "Basic " + Buffer.from("#{@args.user}:#{@args.password}").toString('base64')
		d = new Promise (resolve, reject) ->
			req = self.http.request opt, (resp) ->
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
			req.on 'error', (e) ->
				reject "Enable to query configuration server: #{e.message}"
			req.end()
		d

module.exports = restConf
