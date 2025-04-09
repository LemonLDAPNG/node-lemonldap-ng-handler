var handler = require("lemonldap-ng-handler");

handler.init({
  configStorage: {
    confFile: "../lemonldap/e2e-tests/conf/lemonldap-ng.ini",
  },
});

handler.nginxServer();
