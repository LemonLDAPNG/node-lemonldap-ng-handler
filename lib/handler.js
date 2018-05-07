(function() {
  /*
   * LemonLDAP::NG handler for Node.js/express
   *
   * See README.md for license and copyright
   */
  var Handler, conf, h;

  conf = null;

  'use strict';

  Handler = class Handler {
    constructor(args) {
      var m;
      m = require('./handlerConf');
      this.conf = new m(args);
      this.logger = this.conf.logger;
      this.userLogger = this.conf.userLogger;
    }

    run(req, res, next) {
      var id, protection, self, u, uri, vhost;
      self = this;
      vhost = req.headers.host;
      uri = decodeURI(req.url);
      if (this.conf.tsv.maintenance[vhost]) {
        self.logger.info(`Go to portal with maintenance error code ${vhost}`);
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
            // TODO: display uid
            self.userLogger.info(`User ${session[self.conf.tsv.whatToTrace]} was granted to access to ${uri}`);
            self.sendHeaders(req, session);
            self.hideCookie(req);
            return next();
          }).catch(function(e) {
            self.userLogger.warn(`${session[self.conf.tsv.whatToTrace]} rejected ` + (e.message != null ? e.message : void 0));
            return self.forbidden(req, res, session);
          });
        }).catch(function(e) {
          self.logger.info(e);
          return self.goToPortal(res, 'http://' + vhost + uri);
        });
      } else {
        self.logger.debug("No id");
        u = `://${vhost}${uri}`;
        if ((this.conf.tsv.https != null) && this.conf.tsv.https[vhost]) {
          u = `https${u}`;
        } else {
          u = `http${u}`;
        }
        return this.goToPortal(res, u);
      }
    }

    nginxServer(options) {
      var fcgiOpt, k, self, srv;
      self = this;
      fcgiOpt = {
        mode: "fcgi",
        port: 9090,
        ip: 'localhost'
      };
      if (options != null) {
        for (k in fcgiOpt) {
          if (options[k] != null) {
            fcgiOpt[k] = options[k];
          }
        }
      }
      // Define server
      srv = fcgiOpt.mode === 'fcgi' ? require('node-fastcgi') : require('http');
      srv.createServer(function(req, res) {
        var next, resp;
        next = function() {
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
      return self.logger.info("Server started at " + fcgiOpt.ip + ":" + fcgiOpt.port);
    }

    grant(req, uri, session) {
      var d, self;
      self = this;
      d = new Promise(function(resolve, reject) {
        var i, j, len, ref, rule, vhost;
        vhost = self.resolveAlias(req);
        if (self.conf.tsv.defaultCondition[vhost] == null) {
          self.logger.error(`No configuration found for ${vhost} (or not listed in Node.js virtualHosts)`);
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
    }

    forbidden(req, res, session) {
      var u, uri;
      uri = req.uri;
      u = session._logout;
      if (u) {
        return this.goToPortal(res, u, 'logout=1');
      }
      // req.redirect is defined when running under express. If not
      // we are running as FastCGI server
      return this.setError(res, '/', 403, 'Forbidden');
    }

    sendHeaders(req, session) {
      var err, i, k, ref, v, vhost;
      vhost = this.resolveAlias(req);
      try {
        i = 0;
        ref = this.conf.tsv.forgeHeaders[vhost](session);
        for (k in ref) {
          v = ref[k];
          i++;
          req.headers[k] = v;
          req.rawHeaders.push(k, v);
          // req.redirect is defined when running under express. If not
          // we are running as FastCGI server
          if (req.redirect == null) {
            req.headers[`Headername${i}`] = k;
            req.headers[`Headervalue${i}`] = v;
          }
        }
      } catch (error) {
        err = error;
        this.logger.warn(`No headers configuration found for ${vhost}`);
      }
      return true;
    }

    resolveAlias(req) {
      var vhost;
      vhost = req.headers.host.replace(/:.*$/, '');
      return this.conf.tsv.vhostAlias[vhost] || vhost;
    }

    // Get cookie value
    fetchId(req) {
      var cor;
      if (req.headers.cookie) {
        cor = this.conf.tsv.cookieDetect.exec(req.headers.cookie);
        if (cor && cor[1] !== '0') {
          return cor[1];
        }
      } else {
        return false;
      }
    }

    // Get session from store
    retrieveSession(id) {
      var d, self;
      self = this;
      d = new Promise(function(resolve, reject) {
        return self.conf.sa.get(id).then(function(session) {
          var now;
          // Timestamp in seconds
          now = Date.now() / 1000 | 0;
          if (now - session._utime > self.conf.tsv.timeout || (self.conf.tsv.timeoutActivity && session._lastSeen && now - $session._lastSeen > self.conf.tsv.timeoutActivity)) {
            self.userLogger.info(`Session ${id} expired`);
            reject(false);
          }
          // Update the session to notify activity, if necessary
          if (self.conf.tsv.timeoutActivity && now - session._lastSeen > 60) {
            session._lastSeen = now;
            self.conf.sa.update(id, session);
          }
          return resolve(session);
        }).catch(function() {
          self.userLogger.info(`Session ${id} can't be found in store`);
          return reject(false);
        });
      });
      return d;
    }

    // Check if uri is protected
    isUnprotected(req, uri) {
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
    }

    // Remove LLNG cookie from headers
    hideCookie(req) {
      return req.headers.cookie = req.headers.cookie.replace(this.conf.tsv.cookieDetect, '');
    }

    goToPortal(res, uri, args) {
      var urlc;
      urlc = this.conf.tsv.portal();
      if (uri) {
        urlc += '?url=' + new Buffer(encodeURI(uri)).toString('base64');
      }
      if (args) {
        urlc += uri ? '&' : '?';
        urlc += args;
      }
      // req.redirect is defined when running under express. If not
      // we are running as FastCGI server
      this.logger.debug("Redirecting to " + urlc);
      if (res.redirect) {
        res.redirect(urlc);
      } else {
        // Nginx doesn't accept 302 from a auth request. LLNG Nginx configuration
        // maps 401 to 302 when "Location" is set
        res.writeHead(401, {
          Location: urlc
        });
      }
      return res;
    }

    setError(res, uri, code, txt) {
      var u;
      if (this.conf.tsv.useRedirectOnError) {
        u = `${this.conf.tsv.portal}/lmerror/${code}?url=` + new Buffer(encodeURI(uri)).toString('base64');
        this.logger.debug(`Redirecting to ${u}`);
        if (res.redirect != null) {
          return res.redirect(u);
        } else {
          // Nginx doesn't accept 302 from a auth request. LLNG Nginx configuration
          // maps 401 to 302 when "Location" is set
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
    }

  };

  h = {};

  module.exports = {
    init: function(args) {
      var err;
      if (args.type) {
        try {
          h = require('./handler' + args.type);
          return h = new h(args);
        } catch (error) {
          err = error;
          console.error(`Unable to load ${args.type} handler: ${err}`);
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
    class: Handler
  };

}).call(this);
