
/*
 * LemonLDAP::NG handler for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var conf, h, handler;

  conf = null;

  handler = (function() {
    var fetchId, forbidden, goToPortal, grant, hideCookie, isUnprotected, resolveAlias, retrieveSession, sendHeaders;

    function handler(args) {
      var m;
      m = require('./handlerConf');
      conf = new m(args);
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

    handler.prototype.nginxServer = function(options) {
      var fcgiOpt, k, self, srv;
      self = this;
      fcgiOpt = {
        mode: "fcgi",
        port: 9090,
        ip: 'localhost'
      };
      if (options != null) {
        for (k in fcgiOtp) {
          if (options[k] != null) {
            fcgiOpt = options[k];
          }
        }
      }
      srv = fcgiOpt.mode === 'fcgi' ? require('node-fastcgi') : require('http');
      srv.createServer(function(req, res) {
        var next, resp;
        next = function() {
          console.log("OK");
          return res.writeHead(200, req.headers);
        };
        resp = self.run(req, res, next);
        return resp.then(function() {
          return res.end();
        });
      }).listen(fcgiOpt.port, fcgiOpt.ip);
      return console.log("Server started at " + fcgiOpt.ip + ":" + fcgiOpt.port);
    };

    grant = function(req, uri, session) {
      var i, j, len, ref, rule, vhost;
      vhost = resolveAlias(req);
      if (conf.tsv.defaultCondition[vhost] == null) {
        console.log("No configuration found for " + vhost + " (or not listed in Node.js virtualHosts)");
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
      if (req.redirect != null) {
        return res.status(403).send('Forbidden');
      } else {
        return res.writeHead(403, 'Forbidden');
      }
    };

    sendHeaders = function(req, session) {
      var err, error, i, k, ref, v, vhost;
      vhost = resolveAlias(req);
      try {
        i = 0;
        ref = conf.tsv.forgeHeaders[vhost](session);
        for (k in ref) {
          v = ref[k];
          i++;
          req.headers[k] = v;
          req.rawHeaders.push(k, v);
          if (req.redirect == null) {
            req.headers["Headername" + i] = k;
            req.headers["Headervalue" + i] = v;
          }
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
      if (res.redirect) {
        return res.redirect(urlc);
      } else {
        console.log("Redirecting to " + urlc);
        return res.writeHead(401, {
          Location: urlc
        });
      }
    };

    resolveAlias = function(req) {
      var vhost;
      vhost = req.headers.host.replace(/:.*$/, '');
      return conf.tsv.vhostAlias[vhost] || vhost;
    };

    fetchId = function(req) {
      var cor;
      if (req.headers.cookie) {
        cor = conf.tsv.cookieDetect.exec(req.headers.cookie);
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
      return req.headers.cookie = req.headers.cookie.replace(conf.tsv.cookieDetect, '');
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
    },
    nginxServer: function(options) {
      return h.nginxServer(options);
    }
  };

}).call(this);
