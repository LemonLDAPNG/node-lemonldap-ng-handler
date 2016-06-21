
/*
 * LemonLDAP::NG handler for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var conf, cookieDetect, fetchId, forbidden, goToPortal, grant, isUnprotected, resolveAlias, retrieveSession, sendHeaders;

  conf = null;

  cookieDetect = null;

  exports.init = function(args) {
    conf = require('./handlerConf').init(args);
    cookieDetect = new RegExp("\\b" + conf.tsv.cookieName + "=([^;]+)");
    return exports;
  };

  exports.run = function(req, res, next) {
    var id, protection, session, str, uri, vhost;
    vhost = req.headers.host;
    uri = decodeURI(req.url);
    if (conf.tsv.maintenance[vhost]) {
      console.log('TODO');
    }
    if (conf.tsv.cda && uri.replace(new RegExp("[\\?&;](" + cn + "(http)?=\\w+)$", '', 'i'))) {
      str = RegExp.$1;
    }
    protection = isUnprotected(uri);
    if (protection === 'skip') {
      return next();
    }
    id = fetchId(req);
    if (id) {
      session = retrieveSession(id);
      if (session) {
        if (!grant(req, uri, session)) {
          return forbidden(req, res, session);
        }
        sendHeaders(res, session);
        return next();
      }
    }
    if (protection === 'unprotect') {
      return next();
    }
    return goToPortal(res, 'http://' + vhost + uri);
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
    if (u = conf.datas._logout) {
      return goToPortal(res, u, 'logout=1');
    }
    return res.status(403).send('Forbidden');
  };

  sendHeaders = function(res, session) {};

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
      if (cor && cor[1]) {
        return cor[1];
      }
    } else {
      return false;
    }
  };

  retrieveSession = function(id) {
    var session;
    session = conf.sa.get(id);
    if (!session) {
      console.log("Session " + id + " can't be found in store");
      return null;
    }
    return session;
  };

  isUnprotected = function(uri) {};

}).call(this);
