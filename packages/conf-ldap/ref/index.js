(function () {
  /*
   * LemonLDAP::NG LDAP configuration accessor for Node.js
   *
   * See README.md for license and copyright
   */
  var ldapConf;

  ldapConf = class ldapConf {
    constructor(args) {
      var a, caData, caError, i, len, ref;
      ref = ["ldapServer", "ldapConfBase"];
      // ldapServer ldapConfBase ldapBindDN ldapBindPassword
      for (i = 0, len = ref.length; i < len; i++) {
        a = ref[i];
        if (!args[a]) {
          throw `Missing ${a} argument`;
        }
      }
      this.ldapServer = args.ldapServer.match(/^ldap/)
        ? args.ldapServer
        : `ldap://${args.ldapServer}`;
      this.ldapCa = args.ldapServer.match(/^ldaps/)
        ? args.ldapCAFile || ""
        : "";
      this.ldapConfBase = args.ldapConfBase;
      this.dn = args.ldapBindDN;
      this.pwd = args.ldapBindPassword;
      this.objClass = args.ldapObjectClass || "applicationProcess";
      this.idAttr = args.ldapAttributeId || "cn";
      this.contentAttr = args.ldapAttributeContent || "description";
      this.base = args.ldapConfBase;
      this.caConf = {};
      if (this.ldapCa !== "") {
        try {
          caData = require("fs").readFileSync(this.ldapCa);
          this.caConf = {
            ca: [caData],
          };
        } catch (error) {
          caError = error;
        }
      }
      this.ldap = require("ldapjs").createClient({
        tlsOptions: this.caConf,
        url: this.ldapServer,
      });
    }

    available() {
      var self;
      self = this;
      return new Promise(function (resolve, reject) {
        return self.ldap.bind(self.dn, self.pwd, function (err) {
          var data, opt;
          if (err) {
            return reject(`LDAP bind failed: ${err}`);
          }
          data = [];
          opt = {
            filter: `(objectClass=${self.objClass})`,
            scope: "sub",
            attributes: [self.idAttr],
          };
          return self.ldap.search(self.ldapConfBase, opt, function (err, res) {
            res.on("searchEntry", function (entry) {
              return data.push(
                entry.object[self.idAttr].replace(/lmConf-/, ""),
              );
            });
            res.on("error", function (err) {
              return reject(`LDAP search failed: ${err}`);
            });
            return res.on("end", function (result) {
              return resolve(
                data.sort(function (a, b) {
                  a = parseInt(a, 10);
                  b = parseInt(b, 10);
                  if (a === b) {
                    return 0;
                  } else if (a < b) {
                    return -1;
                  } else {
                    return 1;
                  }
                }),
              );
            });
          });
        });
      });
    }

    lastCfg() {
      var self;
      self = this;
      return new Promise(function (resolve, reject) {
        return self
          .available()
          .then(function (av) {
            return resolve(av.pop());
          })
          .catch(function (err) {
            return reject(err);
          });
      });
    }

    load(cfgNum, fields) {
      var q, self;
      self = this;
      return (q = new Promise(function (resolve, reject) {
        return self.ldap.bind(self.dn, self.pwd, function (err) {
          var conf, data, opt;
          if (err) {
            return reject(`LDAP bind failed: ${err}`);
          }
          data = [];
          conf = {};
          opt = {
            filter: `(objectClass=${self.objClass})`,
            scope: "sub",
          };
          return self.ldap.search(
            `${self.idAttr}=lmConf-${cfgNum},${self.base}`,
            opt,
            function (err, res) {
              if (err) {
                throw err;
              }
              res.on("searchEntry", function (entry) {
                return (data = entry.object[self.contentAttr]);
              });
              res.on("error", function (err) {
                return reject(`LDAP search failed: ${err}`);
              });
              return res.on("end", function (result) {
                var $_, i, k, len, v;
                for (i = 0, len = data.length; i < len; i++) {
                  $_ = data[i];
                  if (!$_.match(/^\{(.*?)\}(.*)/)) {
                    reject(`Bad conf line: ${$_}`);
                  }
                  k = RegExp.$1;
                  v = RegExp.$2;
                  if (v.match != null && v.match(/^{/)) {
                    conf[k] = JSON.parse(v);
                  } else {
                    conf[k] = v;
                  }
                }
                return resolve(conf);
              });
            },
          );
        });
      }));
    }
  };

  module.exports = ldapConf;
}).call(this);
