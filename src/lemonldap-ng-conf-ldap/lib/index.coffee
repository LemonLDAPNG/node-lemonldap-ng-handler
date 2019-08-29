###
# LemonLDAP::NG LDAP configuration accessor for Node.js
#
# See README.md for license and copyright
###

class ldapConf
	constructor: (args) ->
		# ldapServer ldapConfBase ldapBindDN ldapBindPassword
		for a in ['ldapServer','ldapConfBase']
			unless args[a]
				throw "Missing #{a} argument"
		@ldapServer = if args.ldapServer.match(/^ldap/) then args.ldapServer else "ldap://#{args.ldapServer}"
		@ldapConfBase = args.ldapConfBase
		@dn = args.ldapBindDN
		@pwd = args.ldapBindPassword
		@objClass = args.ldapObjectClass or 'applicationProcess'
		@idAttr   = args.ldapAttributeId or 'cn'
		@contentAttr = args.ldapAttributeContent or 'description'
		@base = args.ldapConfBase
		@ldap = require('ldapjs').createClient
			url: @ldapServer

	available: ->
		self = @
		return new Promise (resolve, reject) ->
			self.ldap.bind self.dn, self.pwd, (err) ->
				return reject "LDAP bind failed: #{err}" if err
				data = []
				opt =
					filter: "(objectClass=#{self.objClass})"
					scope: 'sub'
					attributes: [self.idAttr]
				self.ldap.search self.ldapConfBase, opt, (err, res) ->
					res.on 'searchEntry', (entry) ->
						data.push entry.object[self.idAttr].replace /lmConf-/, ''
					res.on 'error', (err) ->
						reject "LDAP search failed: #{err}"
					res.on 'end', (result) ->
						resolve data.sort (a,b) ->
							a = parseInt(a,10)
							b = parseInt(b,10)
							return if a==b then 0 else if a<b then -1 else 1

	lastCfg: ->
		self = @
		return new Promise (resolve, reject) ->
			self.available()
				.then (av) ->
					resolve av.pop()
				.catch (err) ->
					reject err

	load: (cfgNum, fields) ->
		self = @
		q = new Promise (resolve, reject) ->
			self.ldap.bind self.dn, self.pwd, (err) ->
				return reject "LDAP bind failed: #{err}" if err
				data = []
				conf = {}
				opt =
					filter: "(objectClass=#{self.objClass})"
					scope: 'sub'
				self.ldap.search "#{self.idAttr}=lmConf-#{cfgNum},#{self.base}", opt, (err,res) ->
					throw err if err
					res.on 'searchEntry', (entry) ->
						data = entry.object[self.contentAttr]
					res.on 'error', (err) ->
						reject "LDAP search failed: #{err}"
					res.on 'end', (result) ->
						for $_ in data
							unless $_.match /^\{(.*?)\}(.*)/
								reject "Bad conf line: #{$_}"
							k = RegExp.$1
							v = RegExp.$2
							if v.match? and v.match /^{/
								conf[k] = JSON.parse v
							else
								conf[k] = v
						resolve conf

module.exports = ldapConf
