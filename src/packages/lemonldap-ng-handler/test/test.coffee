# Simple test
handler = null

describe 'Initialization tests', () ->
	it 'should load library', () ->
		handler = require('../lib')

	it 'should read packages/lemonldap-ng-handler/test/lemonldap-ng.ini', () ->
		handler.init
			configStorage:
				confFile: "packages/lemonldap-ng-handler/test/lemonldap-ng.ini"

	it 'should initialize ServiceToken', () ->
		handler.init
			type: 'ServiceToken',
			configStorage:
				confFile: "packages/lemonldap-ng-handler/test/lemonldap-ng.ini"

	it 'should initialize DevOps', () ->
		handler.init
			type: 'DevOps',
			configStorage:
				confFile: "packages/lemonldap-ng-handler/test/lemonldap-ng.ini"
