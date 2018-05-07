###
# LemonLDAP::NG handler for Node.js/express
#
# See README.md for license and copyright
###

'use strict'

Handler = require('./handler').class

class HandlerDevOps extends Handler
	constructor: (args) ->
		super(args)
		@lvOpts = []

	grant: (req, uri, session) ->
		vhost = @resolveAlias req
		# Initialize devps conf if needed
		unless @lvOpts.prot
			@conf.tsv.lastVhostUpdate or= {}
			base = @conf.tsv.loopBackUrl or "http://127.0.0.1" # TODO arg + port
			unless base.match /^(https?):\/\/([^\/:]+)(?::(\d+))?(.*)$/
				@logger.error "Bad loopBackUrl #{base}"
			@lvOpts =
				prot: RegExp.$1
				host: RegExp.$2
				path: '/rules.json'
				port: RegExp.$3 or if RegExp.$1 == 'https' then 443 else 80
		self = @
		unless @conf.tsv.defaultCondition[vhost] and (Date.now()/1000 - @conf.tsv.defaultCondition[vhost] < 600 )
			d = new Promise (resolve,reject) ->
				self.loadVhostConfig req, vhost
					.then () ->
						HandlerDevOps.__super__.grant.call(self,req, uri, session).then () ->
							resolve true
						.catch (e) ->
							reject e
					.catch (e) ->
						self.logger.error 'E',e
						HandlerDevOps.__super__.grant.call(self,req, uri, session).then () ->
							resolve true
						.catch (e) ->
							reject e
		else
			super(req, uri, session)

	loadVhostConfig: (req, vhost) ->
		self = @
		d = new Promise (resolve,reject) ->
			# Verify URL
			# Build request
			opts =
				host: self.lvOpts.host
				path: self.lvOpts.path
				port: self.lvOpts.port
				headers:
					Host: vhost
			# and launch it
			http = require self.lvOpts.prot
			req = http.request opts, (resp) ->
				str = ''
				resp.on 'data', (chunk) ->
					str += chunk
				resp.on 'end', () ->
					if str
						rules = ''
						try
							json = JSON.parse str
							# Blank old rules
							self.conf.tsv.locationCondition[vhost] = []
							self.conf.tsv.locationProtection[vhost] = []
							self.conf.tsv.locationRegexp[vhost] = []
							self.conf.tsv.locationCount = 0
							self.conf.tsv.headerList[vhost] = []
							# Parse rules
							for url, rule of json.rules
								[cond, prot] = self.conf.conditionSub rule
								if url == 'default'
									self.conf.tsv.defaultCondition[vhost] = cond
									self.conf.tsv.defaultProtection[vhost] = prot
								else
									self.conf.tsv.locationCondition[vhost].push cond
									self.conf.tsv.locationProtection[vhost].push prot
									self.conf.tsv.locationRegexp[vhost].push(new RegExp url.replace /\(\?#.*?\)/,'')
									self.conf.tsv.locationCount[vhost]++
							unless self.conf.tsv.defaultCondition[vhost]
								self.conf.tsv.defaultCondition[vhost] = () -> 1
								self.conf.tsv.defaultProtection = false
							# Parse headers
							sub = ''
							for h,v of json.headers
								self.conf.tsv.headerList[vhost].push(h)
								val = self.conf.substitute v
								sub += "'#{h}': #{val},"
							sub = sub.replace /,$/, ''
							eval "self.conf.tsv.forgeHeaders['#{vhost}'] = function(session) {return {#{sub}};}"
							return resolve()
						catch err
							self.logger.error "JSON parsing error: #{err}"
					self.logger.info "No rules found, apply default rule"
					self.conf.tsv.defaultCondition[vhost] = () -> 1
					self.conf.tsv.defaultProtection = false
					resolve()
			req.on 'error', (e) ->
				self.logger.error "Unable to load rules.json: #{e.message}"
				reject()
			req.end()
		d

module.exports = HandlerDevOps
