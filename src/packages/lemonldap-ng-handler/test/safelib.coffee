assert = require 'assert'

describe 'Functions tests', () ->
	obj = vm = null
	it 'should load library', () ->
		m = require '../lib/conf'
		obj = new m
			configStorage:
				confFile: "packages/lemonldap-ng-handler/test/lemonldap-ng.ini"
		vm = obj.newSafe()
		console.error 'vm', vm
		assert.ok vm
	it 'should provide basic()', () ->
		array = obj.conditionSub 'basic($u, $p)', vm
		assert.equal array[0](null,{u:"é",p:"à"}), 'Basic 6Trg'
	it 'checkDate should return true or false', () ->
		array = obj.conditionSub 'checkDate(1,99999999999999)', vm
		assert.equal array[0](), true
		array = obj.conditionSub 'checkDate(1,20171231140000)', vm
		assert.equal array[0](), false
	it 'should provide isInNet6', () ->
		array = obj.conditionSub 'isInNet6($i,$net)', vm
		assert.equal array[0](null,{i:"2018::1",net:"2000::0/11"}), true
		assert.equal array[0](null,{i:"2018::1",net:"2000::0/12"}), false
	it 'should provide encrypt', () ->
		array = obj.conditionSub 'encrypt($s)', vm
		assert.equal typeof array[0](null,{s:'a'}), 'string'
	it 'should provide token', () ->
		array = obj.conditionSub 'token($sa,$sb)', vm
		val = array[0] null,{sa:"a",sb:"b"}
		s = obj.tsv.cipher.decrypt val
		a = s.split ':'
		assert.equal a[1],'a'
		assert.equal a[2],'b'
	it 'should provide encode_base64', () ->
		array = obj.conditionSub 'encode_base64("aaa")', vm
		assert.equal array[0](), 'YWFh'
