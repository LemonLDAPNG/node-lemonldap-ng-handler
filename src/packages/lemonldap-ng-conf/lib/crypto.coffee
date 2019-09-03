###
# LemonLDAP::NG crypto module for Node.js/express
#
# See README.md for license and copyright
###

rnd = require 'random-bytes'
sha = require 'sha.js'
aesjs = require 'aes-js'

class Crypto
	constructor: (key, @mode) ->
		@rk = new sha('sha256').update(key).digest()

	newIv: () ->
		tmp = rnd.sync 16
		return Buffer.from Array.prototype.slice.call tmp, 0

	encrypt: (s) ->
		hmac = new sha('sha256').update(s).digest()
		s = Buffer.from s
		s = Buffer.concat [hmac,s]
		l = 16 - s.length % 16
		s = Buffer.concat [s, Buffer.allocUnsafe(l).fill "\0"]
		iv = this.newIv()
		cipher = new aesjs.ModeOfOperation.cbc @rk, iv
		buf = Buffer.concat [iv, cipher.encrypt s]
		res = Buffer(buf).toString 'base64'
		res

	decrypt: (s) ->
		s = s.replace(/%2B/g,'+').replace(/%2F/g,'/').replace(/%3D/g,'=').replace(/%0A/g,"\n")
		s = Buffer.from(s, 'base64')
		iv = s.slice 0, 16
		s = s.slice 16
		cipher = new aesjs.ModeOfOperation.cbc @rk, iv
		res = Buffer.from cipher.decrypt s
		hmac = res.slice 0,32
		res = res.slice 32
		z = res.indexOf "\0"
		if z > 0
			res = res.slice 0, z+1
		res = res.toString()
		newhmac = new sha('sha256').update(res).digest()
		# Remove \0 at end
		res = res.substring 0, res.length-1
		if hmac.equals(newhmac) or hmac.equals(new sha('sha256').update(res).digest())
			return res
		else
			console.error "Bad hmac"
			return res

module.exports = Crypto
