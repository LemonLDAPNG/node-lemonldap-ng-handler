###
# LemonLDAP::NG REST session accessor for Node.js/express
#
# See README.md for license and copyright
###

class RestSession
	constructor: (@logger, @args) ->
		unless @args.baseUrl
			Error "baseUrl parameter is required for REST sessions"
		unless @args.baseUrl.match /(https?):\/\/([^\/:]+)(?::(\d+))?(.*)/
			Error "Bad URL #{@args.baseUrl}"
		@host = RegExp.$2
		@port = RegExp.$3 or if RegExp.$1 == 'https' then 443 else 80
		@path = RegExp.$4 or '/'
		@http = require RegExp.$1
		@path += '/' unless @path.match /\/$/

	get: (id) ->
		self = @
		opt =
			host: @host
			port: @port
			path: @path + id
		if @args.user and @args.password
			opt.headers =
				Authorization: "Basic " + Buffer.from("#{@args.user}:#{@args.password}").toString('base64')
		return new Promise (resolve, reject) ->
			self.logger.debug "Trying to get #{id} from remote #{opt.host}"
			req = self.http.request opt, (resp) ->
				str = ''
				resp.on 'data', (chunk) ->
					str += chunk
				resp.on 'end', () ->
					if str
						try
							tmp = JSON.parse str
							resolve tmp
						catch err
							reject "Error when parsing REST session (#{err})"
					else
						self.logger.info err
						resolve false
			req.on 'error', (e) ->
				self.logger.error "Unable to query session server: #{e.message}"
				reject()
			req.end()

	update: (id, data) ->
		return new Promise (resolve, reject) ->
			Error 'TODO'

module.exports = RestSession
