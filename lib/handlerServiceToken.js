(function() {
  /*
   * LemonLDAP::NG handler for Node.js/express
   *
   * See README.md for license and copyright
   */
  'use strict';
  var Handler, HandlerServiceToken;

  Handler = require('./handler').class;

  HandlerServiceToken = class HandlerServiceToken extends Handler {
    constructor(args) {
      super(args);
    }

    fetchId(req) {
      var s, t, time, token, vh;
      token = '';
      if (req.cgiParams) {
        token = req.cgiParams['HTTP_X_LLNG_TOKEN'];
      } else {
        token = req.header['x-llng-token'];
      }
      if (token) {
        // Decrypt token
        s = this.conf.tsv.cipher.decrypt(token);
        // Token format:
        // time:_session_id:vhost1:vhost2,...
        t = s.split(':');
        // At least one vhost
        if (!t[2]) {
          this.userLogger.error('Bad service token');
          return false;
        }
        // Is token in good interval ?
        time = Date.now() / 1000;
        if (!(t[0] <= time && t[0] > time - 30)) {
          this.userLogger.warn('Expired service token');
          return false;
        }
        // Is vhost listed in token ?
        vh = this.resolveAlias(req);
        if (!(t.indexOf(vh) > 1)) {
          this.userLogger.error(`${vh} not authorizated in token (${s})`);
          return false;
        }
        // Retun _session_id
        return t[1];
      }
      return super.fetchId(req);
    }

  };

  module.exports = HandlerServiceToken;

}).call(this);
