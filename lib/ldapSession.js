(function() {
  /*
   * LemonLDAP::NG LDAP session accessor for Node.js/express
   *
   * See README.md for license and copyright
   */
  var LdapSession;

  LdapSession = class LdapSession {
    constructor(logger, args) {
      var L, a, i, len, ref, self;
      this.logger = logger;
      ref = ['ldapServer', 'ldapConfBase'];
      // ldapServer ldapConfBase ldapBindDN ldapBindPassword
      for (i = 0, len = ref.length; i < len; i++) {
        a = ref[i];
        if (!args[a]) {
          throw `Missing ${a} argument`;
        }
      }
      this.ldapServer = args.ldapServer.match(/^ldap/) ? args.ldapServer : `ldap://${args.ldapServer}`;
      this.ldapConfBase = args.ldapConfBase;
      this.dn = args.ldapBindDN;
      this.pwd = args.ldapBindPassword;
      this.objClass = args.ldapObjectClass || 'applicationProcess';
      this.idAttr = args.ldapAttributeId || 'cn';
      this.contentAttr = args.ldapAttributeContent || 'description';
      this.base = args.ldapConfBase;
      L = require('ldapjs');
      this.ldap = require('ldapjs').createClient({
        url: this.ldapServer
      });
      self = this;
      this.ldap.bind(this.dn, this.pwd, function(err) {
        if (err) {
          return self.logger.error(`LDAP bind failed: ${err}`);
        } else {
          return self.logger.debug("LDAP session ready");
        }
      });
    }

    // get(): Recover session data
    get(id) {
      var q, self;
      self = this;
      return q = new Promise(function(resolve, reject) {
        var conf, data, opt;
        data = [];
        conf = {};
        opt = {
          filter: `(objectClass=${self.objClass})`,
          scope: 'base',
          args: [self.contentAttr]
        };
        return self.ldap.search(`${self.idAttr}=${id},${self.base}`, opt, function(err, res) {
          if (err) {
            return reject(err);
          }
          res.on('searchEntry', function(entry) {
            return data = entry.object[self.contentAttr];
          });
          res.on('error', function(err) {
            return reject(`LDAP search failed: ${err}`);
          });
          return res.on('end', function(result) {
            var e;
            try {
              return resolve(JSON.parse(data));
            } catch (error) {
              e = error;
              return reject(`LDAP session parse error: ${e}`);
            }
          });
        });
      });
    }

    update(id, data) {
      var q, self;
      self = this;
      return q = new Promise(function(resolve, reject) {
        var change, json;
        json = JSON.stringify(data);
        change = {};
        change[self.contentAttr] = [json];
        change = self.ldap.Change({
          operation: 'replace',
          modification: change
        });
        return self.ldap.modify(`${self.idAttr}=${id},${self.base}`, change, function(err) {
          if (err) {
            return reject(err);
          }
          return resolve(data);
        });
      });
    }

  };

  module.exports = LdapSession;

}).call(this);
