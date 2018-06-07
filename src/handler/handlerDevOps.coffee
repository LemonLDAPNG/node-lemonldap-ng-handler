###
# LemonLDAP::NG DevOps handler
# (see https://lemonldap-ng.org/documentation/2.0/devopshandler)
#
# See README.md for license and copyright
###

Handler = require('./handler').class

class HandlerDevOps extends Handler
	constructor: (args) ->
		super(args)

	# Override grant() to get application rules.json before checking access
	grant: (req, uri, session) ->
		vhost = @resolveAlias req
		# Calculates rules.json URL
		self = @
		@conf.tsv.lastVhostUpdate or= {}
		# Initialize devops conf if needed (each 10mn)
		unless @conf.tsv.defaultCondition[vhost] and (Date.now()/1000 - @conf.tsv.lastVhostUpdate[vhost] < 600 )
			# TODO: FALSE !!!
			base = if req.cgiParams and req.cgiParams['RULES_URL'] then req.cgiParams['RULES_URL'] else "#{@conf.tsv.loopBackUrl or 'http://127.0.0.1'}/rules.json"
			unless base.match /^(https?):\/\/([^\/:]+)(?::(\d+))?(.*)$/
				@logger.error "Bad loopBackUrl #{base}"
			lvOpts =
				prot: RegExp.$1
				host: RegExp.$2
				path: RegExp.$4
				port: RegExp.$3 or if RegExp.$1 == 'https' then 443 else 80
			unless req.cgiParams and req.cgiParams['RULES_URL']
				lvOpts.lb = true
			up = super.grant
			d = new Promise (resolve,reject) ->
				self.loadVhostConfig req, vhost, lvOpts
					.then () ->
						up.call(self, req, uri, session).then ->
							resolve true
						.catch (e) ->
							reject e
					.catch (e) ->
						self.logger.error 'E',e
						up.call(self, req, uri, session).then ->
							resolve true
						.catch (e) ->
							reject e
			return d
		else
			super(req, uri, session)

	loadVhostConfig: (req, vhost, lvOpts) ->
		self = @
		d = new Promise (resolve,reject) ->
			# Verify URL
			# Build request
			vhost = lvOpts.host unless lvOpts.lb
			opts =
				host: lvOpts.host
				path: lvOpts.path
				port: lvOpts.port
				headers:
					Host: vhost
			# and launch it
			self.logger.debug "Trying to get #{lvOpts.prot}://#{vhost}:#{lvOpts.port}#{lvOpts.path}"
			http = require lvOpts.prot
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
							self.conf.safe[vhost] = self.conf.newSafe()
							for url, rule of json.rules
								rule = new String(rule).valueOf()
								self.logger.debug "Compile #{rule}"
								[cond, prot] = self.conf.conditionSub rule, self.conf.safe[vhost]
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
							self.conf.vm.runInContext "fg = function(session) {return {#{sub}};}", self.conf.safe[vhost]
							self.conf.tsv.forgeHeaders[vhost] = self.conf.safe[vhost].fg
							self.conf.tsv.lastVhostUpdate[vhost] = Date.now()/1000
							return resolve()
						catch err
							self.logger.error "JSON parsing error: #{err}"
					self.logger.info "No rules found, apply default rule"
					self.conf.tsv.defaultCondition[vhost] = () -> 1
					self.conf.tsv.defaultProtection = false
					self.conf.tsv.lastVhostUpdate[vhost] = Date.now()/1000
					resolve()
			req.on 'error', (e) ->
				self.logger.error "Unable to load rules.json: #{e.message}"
				reject()
			req.end()
		d

module.exports = HandlerDevOps
