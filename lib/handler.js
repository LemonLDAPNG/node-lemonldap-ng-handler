
/*
 * LemonLDAP::NG handler for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var conf, cookieDetect, h, handler;

  conf = null;

  cookieDetect = null;

  handler = (function() {
    var fetchId, forbidden, goToPortal, grant, hideCookie, isUnprotected, resolveAlias, retrieveSession, sendHeaders;

    function handler(args) {
      var m;
      m = require('./handlerConf');
      conf = new m(args);
      cookieDetect = new RegExp("\\b" + conf.tsv.cookieName + "=([^;]+)");
    }

    handler.prototype.run = function(req, res, next) {
      var id, protection, str, uri, vhost;
      vhost = req.headers.host;
      uri = decodeURI(req.url);
      if (conf.tsv.maintenance[vhost]) {
        console.log('TODO');
      }
      if (conf.tsv.cda && uri.replace(new RegExp("[\\?&;](" + cn + "(http)?=\\w+)$", '', 'i'))) {
        str = RegExp.$1;
      }
      protection = isUnprotected(req, uri);
      if (protection === 'skip') {
        return next();
      }
      id = fetchId(req);
      if (id) {
        return retrieveSession(id).then(function(session) {
          if (!grant(req, uri, session)) {
            return forbidden(req, res, session);
          } else {
            sendHeaders(req, session);
            hideCookie(req);
            return next();
          }
        })["catch"](function() {
          return goToPortal(res, 'http://' + vhost + uri);
        });
      } else {
        return goToPortal(res, 'http://' + vhost + uri);
      }
    };

    grant = function(req, uri, session) {
      var i, j, len, ref, rule, vhost;
      vhost = resolveAlias(req);
      if (conf.tsv.defaultCondition[vhost] == null) {
        console.log("No configuration found for " + vhost);
        return false;
      }
      ref = conf.tsv.locationRegexp[vhost];
      for (i = j = 0, len = ref.length; j < len; i = ++j) {
        rule = ref[i];
        if (uri.match(rule)) {
          return conf.tsv.locationCondition[vhost][i](session);
        }
      }
      return conf.tsv.defaultCondition[vhost](session);
    };

    forbidden = function(req, res, session) {
      var u, uri;
      uri = req.uri;
      u = session._logout;
      if (u) {
        return goToPortal(res, u, 'logout=1');
      }
      return res.status(403).send('Forbidden');
    };

    sendHeaders = function(req, session) {
      var err, error, k, ref, v, vhost;
      vhost = resolveAlias(req);
      try {
        ref = conf.tsv.forgeHeaders[vhost](session);
        for (k in ref) {
          v = ref[k];
          req.headers[k] = v;
          req.rawHeaders.push(k, v);
        }
      } catch (error) {
        err = error;
        console.log("No headers configuration found for " + vhost);
      }
      return true;
    };

    goToPortal = function(res, uri, args) {
      var urlc;
      urlc = conf.tsv.portal();
      if (uri) {
        urlc += '?url=' + new Buffer(encodeURI(uri)).toString('base64');
      }
      if (args) {
        urlc += uri ? '&' : '?';
        urlc += args;
      }
      return res.redirect(urlc);
    };

    resolveAlias = function(req) {
      var vhost;
      vhost = req.headers.host.replace(/:.*$/, '');
      return conf.tsv.vhostAlias[vhost] || vhost;
    };

    fetchId = function(req) {
      var cor;
      if (req.headers.cookie) {
        cor = cookieDetect.exec(req.headers.cookie);
        if (cor && cor[1] !== '0') {
          return cor[1];
        }
      } else {
        return false;
      }
    };

    retrieveSession = function(id) {
      var d;
      d = new Promise(function(resolve, reject) {
        return conf.sa.get(id).then(function(session) {
          var now;
          now = Date.now() / 1000 | 0;
          if (now - session._utime > conf.tsv.timeout || (conf.tsv.timeoutActivity && session._lastSeen && now - $session._lastSeen > conf.tsv.timeoutActivity)) {
            console.log("Session " + id + " expired");
            reject(false);
          }
          if (conf.tsv.timeoutActivity && now - session._lastSeen > 60) {
            session._lastSeen = now;
            conf.sa.update(id, session);
          }
          return resolve(session);
        })["catch"](function() {
          console.log("Session " + id + " can't be found in store");
          return reject(false);
        });
      });
      return d;
    };

    isUnprotected = function(req, uri) {
      var i, j, len, ref, rule, vhost;
      vhost = resolveAlias(req);
      if (conf.tsv.defaultCondition[vhost] == null) {
        return false;
      }
      ref = conf.tsv.locationRegexp[vhost];
      for (i = j = 0, len = ref.length; j < len; i = ++j) {
        rule = ref[i];
        if (uri.match(rule)) {
          return conf.tsv.locationProtection[vhost][i];
        }
      }
      return conf.tsv.defaultProtection[vhost];
    };

    hideCookie = function(req) {
      return req.headers.cookie = req.headers.cookie.replace(cookieDetect, '');
    };

    return handler;

  })();

  h = {};

  module.exports = {
    init: function(args) {
      return h = new handler(args);
    },
    run: function(req, res, next) {
      return h.run(req, res, next);
    }
  };

}).call(this);
