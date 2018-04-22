// Simple test
var handler = require('../lib/handler.js');

handler.init({
  configStorage: {
    "confFile": "test/lemonldap-ng.ini"
  }
});

// Service token test

var h = handler.init({
  type: 'ServiceToken',
  configStorage: {
    "confFile": "test/lemonldap-ng.ini"
  }
});

// DevOps test

var h = handler.init({
  type: 'DevOps',
  configStorage: {
    "confFile": "test/lemonldap-ng.ini"
  }
});

