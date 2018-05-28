###
# LemonLDAP::NG LDAP configuration accessor for Node.js
#
# See README.md for license and copyright
###

class ldapConf
	constructor: (args) ->
		# ldapServer ldapConfBase ldapBindDN ldapBindPassword
		@objClass = args.ldapObjectClass or 'applicationProcess'
		@idAttr   = args.ldapAttributeId or 'cn'
		@contentAttr = args.ldapAttributeContent or 'description'
		@base = args.ldapConfBase
		L = require 'ldap-client'
		@ldap = new L
			uri: args.ldapServer
			base: @base
			scope: L.ONELEVEL
			connect: () ->
				opt = {}
				if args.ldapBindDN
					opt =
						binddn: args.ldapBindDN
						password: args.ldapBindPassword
				this.simplebind opt, (err) ->
					throw "Unable to connect to LDAP server: #{err}" if err
					console.log args
		, (err) ->
			Error "Unable to connect to LDAP server: #{err}" if err

	available: ->
		self = @
		return new Promise (resolve, reject) ->
			self.ldap.search
				filter: "(objectClass=#{self.objClass}"
				attrs: [self.idAttr]
			, (err, data) ->
				return reject "LDAP search failed: #{err}" if err
				data = data.map ($_) ->
					return $_.idAttr
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
			self.ldap.search
				base: "#{self.idAttr}=lmConf-#{cfgNum},#{self.base}"
				filter: "(objectClass=#{self.objClass}"
				attrs: [self.contentAttr]
			, (err, data) ->
				return reject "LDAP search failed: #{err}" if err
				data = data.map ($_) ->
					$_[self.contentAttr]
				res = {}
				for $_ in data
					unless $_.match /^\{(.*?)\}(.*)/
						reject "Bad conf line: #{$_}"
					k = RegExp.$1
					v = RegExp.$2
					if v.match? and v.match /^{/
						res[k] = JSON.parse v
					else
						res[k] = v
				resolve res

module.exports = ldapConf
