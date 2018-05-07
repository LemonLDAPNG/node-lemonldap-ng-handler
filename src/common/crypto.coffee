###
# LemonLDAP::NG crypto module for Node.js/express
#
# See README.md for license and copyright
###

'use strict'

class Crypto
	constructor: (key, @mode) ->
		MD5 = require 'js-md5'
		h = MD5.create()
		h.update(key)
		@aesjs = require 'aes-js'
		@iv = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
		@rk = h.digest()
		@tob = @aesjs.utils.utf8.toBytes
		@frb = @aesjs.utils.utf8.fromBytes

	encrypt: (s) ->
		l = 16 - s.length % 16
		s = s.padEnd s.length+l, "\0"
		cipher = new @aesjs.ModeOfOperation.cbc(@rk, @iv)
		buf = cipher.encrypt @tob s
		new Buffer(buf).toString('base64')

	decrypt: (s) ->
		s = Buffer.from(s, 'base64')
		cipher = new @aesjs.ModeOfOperation.cbc(@rk, @iv)
		res = @frb cipher.decrypt s
		res = res.replace /\0/g, ''

module.exports = Crypto
