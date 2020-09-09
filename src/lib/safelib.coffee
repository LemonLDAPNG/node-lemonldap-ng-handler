###
#
# Extended functions
# (see https://lemonldap-ng.org/documentation/latest/extendedfunctions)
#
###

Iconv = null

class ExtdFunc
	cipher = null
	constructor: (c) ->
		cipher = c
		try
			Iconv = require('iconv').Iconv
		catch e
			console.log "iconv module not available"

	date: date

	hostname: (req) ->
		return req.headers.host

	remote_ip: (req) ->
		return if req.ip? then req.ip else req.cgiParams.REMOTE_ADDR

	basic: (login, pwd) ->
		return "Basic " + unicode2iso("#{login}:#{pwd}").toString('base64')

	groupMatch: (groups, attr, value) ->
		match = 0
		re = new RegExp value
		for group, v of groups
			if v[attr]?
				if typeof v[attr] == 'object'
					for s in v[attr]
						match++ if s.match re
				else
					match++ if v[attr].match re
		return match

	isInNet6: (ip, net) ->
		test = require 'ipaddr.js'
		ip = test.parse(ip)
		net = net.replace /^(.*)\/(.*)/, "$1"
		bits = RegExp.$2
		net = test.parse(net)
		return ip.match net, bits

	checkLogonHours: (logonHours, syntax='hexadecimal', timeCorrection, defaultAccess=0) ->
		timeCorrection = parseInt timeCorrection
		d = new Date()
		hourPos = d.getDay() * 24 + d.getHours() + timeCorrection
		div = if syntax == 'octetstring' then 3 else 4
		pos = Math.trunc(hourPos/div)
		v1 = Math.pow(2,hourPos % div)
		v2 = logonHours.substr(pos,1)
		if v2.match /\d/
			v2 = parseInt v2 # Cast as int
		else
			v2 = v2.charCodeAt(0)
			v2 = if v2 > 70 then v2 - 87 else v2 - 55
		return v1 & v2

	checkDate: (start=0, end, defaultAccess=0) ->
		start = start + ''
		start = start.substring(0,14)
		end   = end + ''
		end   = end.substring(0,14)
		return defaultAccess unless start or end
		end or= 999999999999999
		d = date()
		return if (d >= start and d <= end) then true else false

	unicode2iso: (s) ->
		unicode2iso s

	iso2unicode: (s) ->
		iconv = new Iconv('ISO-8859-1', 'UTF-8')
		return iconv.convert(s)

	encrypt: (s) ->
		encrypt s

	token: () ->
		time = Math.trunc Date.now()/1000 # Perl time
		args = Array.from arguments
		return encrypt "#{time}:#{args.join(':')}"

	encode_base64: (s) ->
		r = new Buffer.from(s).toString('base64')

	unicode2iso = (s) ->
		iconv = new Iconv('UTF-8', 'ISO-8859-1')
		return iconv.convert(s)

	date = ->
		d = new Date()
		s = ''
		a = [ d.getFullYear(), d.getMonth()+1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds() ]
		for x in a
			s += if x<10 then "0#{x}" else "#{x}"
		return s

	encrypt = (s) ->
		return cipher.encrypt s

module.exports = ExtdFunc
