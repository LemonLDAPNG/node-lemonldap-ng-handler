// Simple test
var handler;

describe('Initialization tests', function() {
  it('should load library', function() {
    handler = require('../lib');
  });

  it('should read test/lemonldap-ng.ini', function() {
    handler.init({
      configStorage: {
        "confFile": "test/lemonldap-ng.ini"
      }
    });
  });

  it('should initialize ServiceToken', function() {
    handler.init({
      type: 'ServiceToken',
      configStorage: {
        "confFile": "test/lemonldap-ng.ini"
      }
    });
  });

  it('should initialize DevOps', function() {
    handler.init({
      type: 'DevOps',
      configStorage: {
        "confFile": "test/lemonldap-ng.ini"
      }
    });
  });
});
