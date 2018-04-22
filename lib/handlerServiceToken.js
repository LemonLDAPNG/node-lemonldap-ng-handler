
/*
 * LemonLDAP::NG handler for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var Handler, HandlerServiceToken,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  Handler = require('./handler')["class"];

  HandlerServiceToken = (function(superClass) {
    extend(HandlerServiceToken, superClass);

    function HandlerServiceToken(args) {
      HandlerServiceToken.__super__.constructor.call(this, args);
    }

    HandlerServiceToken.prototype.fetchId = function(req) {
      var s, t, time, token, vh;
      if (req.cgiParams && (token = req.cgiParams['HTTP_X_LLNG_TOKEN'])) {
        s = this.conf.tsv.cipher.decrypt(token);
        t = s.split(':');
        if (!t[2]) {
          console.error('Bad service token');
          return false;
        }
        time = Date.now() / 1000;
        if (!(t[0] <= time && t[0] > time - 30)) {
          console.error('Expired service token');
          return false;
        }
        vh = this.resolveAlias(req);
        if (!(t.indexOf(vh) > 1)) {
          console.error(vh + " not authorizated in token (" + s + ")");
          return false;
        }
        return t[1];
      }
      return HandlerServiceToken.__super__.fetchId.call(this, req);
    };

    return HandlerServiceToken;

  })(Handler);

  module.exports = HandlerServiceToken;

}).call(this);
