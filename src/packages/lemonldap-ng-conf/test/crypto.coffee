assert = require 'assert'
crypto = require '../lib/crypto'
crypto = new crypto 'qwertyui'

describe 'Crypto test', () ->
	data = require './cr.json'
	it 'should decrypt its encrypted data', () ->
		for k,v of data
			s = crypto.encrypt k
			assert.equal k, crypto.decrypt s
	it 'should encode like Perl libraries', () ->
		for k,v of data
			assert.equal k, crypto.decrypt v
