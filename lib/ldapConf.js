(function() {
  /*
   * LemonLDAP::NG LDAP configuration accessor for Node.js
   *
   * See README.md for license and copyright
   */
  var ldapConf;

  ldapConf = class ldapConf {
    constructor(args) {
      var L;
      // ldapServer ldapConfBase ldapBindDN ldapBindPassword
      this.objClass = args.ldapObjectClass || 'applicationProcess';
      this.idAttr = args.ldapAttributeId || 'cn';
      this.contentAttr = args.ldapAttributeContent || 'description';
      this.base = args.ldapConfBase;
      L = require('ldap-client');
      this.ldap = new L({
        uri: args.ldapServer,
        base: this.base,
        scope: L.ONELEVEL,
        connect: function() {
          var opt;
          opt = {};
          if (args.ldapBindDN) {
            opt = {
              binddn: args.ldapBindDN,
              password: args.ldapBindPassword
            };
          }
          return this.simplebind(opt, function(err) {
            if (err) {
              throw `Unable to connect to LDAP server: ${err}`;
            }
            return console.log(args);
          });
        }
      }, function(err) {
        if (err) {
          return Error(`Unable to connect to LDAP server: ${err}`);
        }
      });
    }

    available() {
      var self;
      self = this;
      return new Promise(function(resolve, reject) {
        return self.ldap.search({
          filter: `(objectClass=${self.objClass}`,
          attrs: [self.idAttr]
        }, function(err, data) {
          if (err) {
            return reject(`LDAP search failed: ${err}`);
          }
          data = data.map(function($_) {
            return $_.idAttr;
          });
          return resolve(data.sort(function(a, b) {
            a = parseInt(a, 10);
            b = parseInt(b, 10);
            if (a === b) {
              return 0;
            } else if (a < b) {
              return -1;
            } else {
              return 1;
            }
          }));
        });
      });
    }

    lastCfg() {
      var self;
      self = this;
      return new Promise(function(resolve, reject) {
        return self.available().then(function(av) {
          return resolve(av.pop());
        }).catch(function(err) {
          return reject(err);
        });
      });
    }

    load(cfgNum, fields) {
      var q, self;
      self = this;
      return q = new Promise(function(resolve, reject) {
        return self.ldap.search({
          base: `${self.idAttr}=lmConf-${cfgNum},${self.base}`,
          filter: `(objectClass=${self.objClass}`,
          attrs: [self.contentAttr]
        }, function(err, data) {
          var $_, i, k, len, res, v;
          if (err) {
            return reject(`LDAP search failed: ${err}`);
          }
          data = data.map(function($_) {
            return $_[self.contentAttr];
          });
          res = {};
          for (i = 0, len = data.length; i < len; i++) {
            $_ = data[i];
            if (!$_.match(/^\{(.*?)\}(.*)/)) {
              reject(`Bad conf line: ${$_}`);
            }
            k = RegExp.$1;
            v = RegExp.$2;
            if ((v.match != null) && v.match(/^{/)) {
              res[k] = JSON.parse(v);
            } else {
              res[k] = v;
            }
          }
          return resolve(res);
        });
      });
    }

  };

  module.exports = ldapConf;

}).call(this);
