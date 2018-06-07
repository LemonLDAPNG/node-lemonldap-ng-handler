(function() {
  /*
   * LemonLDAP::NG handler-service-token for Node.js/express
   * (see https://lemonldap-ng.org/documentation/2.0/servertoserver)
   *
   * See README.md for license and copyright
   */
  var HandlerDevOps, HandlerDevOpsST, HandlerServiceToken;

  HandlerServiceToken = require('./handlerServiceToken');

  HandlerDevOps = require('./handlerDevOps');

  HandlerDevOpsST = class HandlerDevOpsST extends HandlerDevOps {
    fetchId(req) {
      return HandlerServiceToken.prototype.fetchId.call(this, req);
    }

  };

  module.exports = HandlerDevOpsST;

}).call(this);
