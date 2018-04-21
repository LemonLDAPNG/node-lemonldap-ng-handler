
/*
 * LemonLDAP::NG handler for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var Handler, conf, h;

  conf = null;

  Handler = (function() {
    function Handler(args) {
      var m;
      m = require('./handlerConf');
      this.conf = new m(args);
    }

    Handler.prototype.run = function(req, res, next) {
      var id, protection, self, u, uri, vhost;
      self = this;
      vhost = req.headers.host;
      uri = decodeURI(req.url);
      if (this.conf.tsv.maintenance[vhost]) {
        console.error("Go to portal with maintenance error code " + vhost);
        return this.setError(res, '/', 503, 'Service Temporarily Unavailable');
      }
      protection = this.isUnprotected(req, uri);
      if (protection === 'skip') {
        return next();
      }
      id = this.fetchId(req);
      if (id) {
        return self.retrieveSession(id).then(function(session) {
          return self.grant(req, uri, session).then(function() {
            console.log("Granted " + id);
            self.sendHeaders(req, session);
            self.hideCookie(req);
            return next();
          })["catch"](function(e) {
            console.log((id + " rejected ") + (e.message != null ? e.message : void 0));
            return self.forbidden(req, res, session);
          });
        })["catch"](function(e) {
          console.error(e);
          return self.goToPortal(res, 'http://' + vhost + uri);
        });
      } else {
        console.log("No id");
        u = "://" + vhost + uri;
        if ((this.conf.tsv.https != null) && this.conf.tsv.https[vhost]) {
          u = "https" + u;
        } else {
          u = "http" + u;
        }
        return this.goToPortal(res, u);
      }
    };

    Handler.prototype.nginxServer = function(options) {
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
          console.log("Granted");
          return res.writeHead(200, req.headers);
        };
        resp = self.run(req, res, next);
        if (resp.then) {
          return resp.then(function() {
            return res.end();
          });
        } else {
          return res.end();
        }
      }).listen(fcgiOpt.port, fcgiOpt.ip);
      return console.log("Server started at " + fcgiOpt.ip + ":" + fcgiOpt.port);
    };

    Handler.prototype.grant = function(req, uri, session) {
      var d, self;
      self = this;
      d = new Promise(function(resolve, reject) {
        var i, j, len, ref, rule, vhost;
        vhost = self.resolveAlias(req);
        if (self.conf.tsv.defaultCondition[vhost] == null) {
          console.error("No configuration found for " + vhost + " (or not listed in Node.js virtualHosts)");
          return reject();
        }
        ref = self.conf.tsv.locationRegexp[vhost];
        for (i = j = 0, len = ref.length; j < len; i = ++j) {
          rule = ref[i];
          if (uri.match(rule)) {
            return resolve(self.conf.tsv.locationCondition[vhost][i](req, session));
          }
        }
        if (self.conf.tsv.defaultCondition[vhost](req, session)) {
          return resolve();
        } else {
          return reject();
        }
      });
      return d;
    };

    Handler.prototype.forbidden = function(req, res, session) {
      var u, uri;
      uri = req.uri;
      u = session._logout;
      if (u) {
        return this.goToPortal(res, u, 'logout=1');
      }
      return this.setError(res, '/', 403, 'Forbidden');
    };

    Handler.prototype.sendHeaders = function(req, session) {
      var err, error, i, k, ref, v, vhost;
      vhost = this.resolveAlias(req);
      try {
        i = 0;
        ref = this.conf.tsv.forgeHeaders[vhost](session);
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
        console.error("No headers configuration found for " + vhost);
      }
      return true;
    };

    Handler.prototype.resolveAlias = function(req) {
      var vhost;
      vhost = req.headers.host.replace(/:.*$/, '');
      return this.conf.tsv.vhostAlias[vhost] || vhost;
    };

    Handler.prototype.fetchId = function(req) {
      var cor;
      if (req.headers.cookie) {
        cor = this.conf.tsv.cookieDetect.exec(req.headers.cookie);
        if (cor && cor[1] !== '0') {
          return cor[1];
        }
      } else {
        return false;
      }
    };

    Handler.prototype.retrieveSession = function(id) {
      var d, self;
      self = this;
      d = new Promise(function(resolve, reject) {
        return self.conf.sa.get(id).then(function(session) {
          var now;
          now = Date.now() / 1000 | 0;
          if (now - session._utime > self.conf.tsv.timeout || (self.conf.tsv.timeoutActivity && session._lastSeen && now - $session._lastSeen > self.conf.tsv.timeoutActivity)) {
            console.log("Session " + id + " expired");
            reject(false);
          }
          if (self.conf.tsv.timeoutActivity && now - session._lastSeen > 60) {
            session._lastSeen = now;
            self.conf.sa.update(id, session);
          }
          return resolve(session);
        })["catch"](function() {
          console.log("Session " + id + " can't be found in store");
          return reject(false);
        });
      });
      return d;
    };

    Handler.prototype.isUnprotected = function(req, uri) {
      var i, j, len, ref, rule, vhost;
      vhost = this.resolveAlias(req);
      if (this.conf.tsv.defaultCondition[vhost] == null) {
        return false;
      }
      ref = this.conf.tsv.locationRegexp[vhost];
      for (i = j = 0, len = ref.length; j < len; i = ++j) {
        rule = ref[i];
        if (uri.match(rule)) {
          return this.conf.tsv.locationProtection[vhost][i];
        }
      }
      return this.conf.tsv.defaultProtection[vhost];
    };

    Handler.prototype.hideCookie = function(req) {
      return req.headers.cookie = req.headers.cookie.replace(this.conf.tsv.cookieDetect, '');
    };

    Handler.prototype.goToPortal = function(res, uri, args) {
      var urlc;
      urlc = this.conf.tsv.portal();
      if (uri) {
        urlc += '?url=' + new Buffer(encodeURI(uri)).toString('base64');
      }
      if (args) {
        urlc += uri ? '&' : '?';
        urlc += args;
      }
      console.log("Redirecting to " + urlc);
      if (res.redirect) {
        res.redirect(urlc);
      } else {
        res.writeHead(401, {
          Location: urlc
        });
      }
      return res;
    };

    Handler.prototype.setError = function(res, uri, code, txt) {
      var u;
      if (this.conf.tsv.useRedirectOnError) {
        u = (this.conf.tsv.portal + "/lmerror/" + code + "?url=") + new Buffer(encodeURI(uri)).toString('base64');
        console.log("Redirecting to " + u);
        if (res.redirect != null) {
          return res.redirect(u);
        } else {
          return res.writeHead(401, {
            Location: u
          });
        }
      } else {
        if (res.redirect != null) {
          return res.status(code).send(txt);
        } else {
          return res.writeHead(code, txt);
        }
      }
    };

    return Handler;

  })();

  h = {};

  module.exports = {
    init: function(args) {
      if (args.type) {
        if (args.type === 'DevOps') {
          h = require('./handlerDevOps');
          return h = new h(args);
        }
      }
      return h = new Handler(args);
    },
    run: function(req, res, next) {
      return h.run(req, res, next);
    },
    nginxServer: function(options) {
      return h.nginxServer(options);
    },
    "class": Handler
  };

}).call(this);
