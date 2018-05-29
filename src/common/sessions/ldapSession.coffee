###
# LemonLDAP::NG LDAP session accessor for Node.js/express
#
# See README.md for license and copyright
###

class LdapSession
	constructor: (@logger, args) ->
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
		L = require 'ldapjs'
		@ldap = require('ldapjs').createClient
			url: @ldapServer
		self = @
		@ldap.bind @dn, @pwd, (err) ->
			if err
				self.logger.error "LDAP bind failed: #{err}"
			else
				self.logger.debug "LDAP session ready"

	# get(): Recover session data
	get: (id) ->
		self = @
		q = new Promise (resolve, reject) ->
			data = []
			conf = {}
			opt =
				filter: "(objectClass=#{self.objClass})"
				scope: 'base'
				args: [self.contentAttr]
			self.ldap.search "#{self.idAttr}=#{id},#{self.base}", opt, (err,res) ->
				return reject err if err
				res.on 'searchEntry', (entry) ->
					data = entry.object[self.contentAttr]
				res.on 'error', (err) ->
					reject "LDAP search failed: #{err}"
				res.on 'end', (result) ->
					try
						resolve JSON.parse data
					catch e
						reject "LDAP session parse error: #{e}"

	update: (id, data) ->
		self = @
		q = new Promise (resolve, reject) ->
			json = JSON.stringify data
			change = {}
			change[self.contentAttr] = [json]
			change = self.ldap.Change
				operation: 'replace'
				modification: change
			self.ldap.modify "#{self.idAttr}=#{id},#{self.base}", change, (err) ->
				return reject err if err
				resolve data

module.exports = LdapSession
