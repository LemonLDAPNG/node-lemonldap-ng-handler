(function() {
  /*
   * LemonLDAP::NG MongoDB configuration accessor for Node.js
   *
   * See README.md for license and copyright
   */
  var MongoConf;

  MongoConf = class MongoConf {
    constructor(args) {
      var dbName, i, j, len, len1, mongodb, nam2, name, opt, ref, s, self, tmp, url;
      dbName = args.dbName || 'llConfDB';
      this.colName = args.collectionName || 'configuration';
      // Build url
      url = `mongodb://${args.host || '127.0.0.1'}:${args.port || '27017'}/?`;
      ref = ['host', 'auth_mechanism', 'auth_mechanism_properties', 'bson_codec', 'connect_timeout_ms', 'db_name', 'heartbeat_frequency_ms', 'j', 'local_threshold_ms', 'max_time_ms', 'password', 'port', 'read_pref_mode', 'read_pref_tag_sets', 'replica_set_name', 'server_selection_timeout_ms', 'server_selection_try_once', 'socket_check_interval_ms', 'socket_timeout_ms', 'ssl', 'username', 'w', 'wtimeout', 'read_concern_level'];
      for (i = 0, len = ref.length; i < len; i++) {
        name = ref[i];
        tmp = name.split('_');
        nam2 = tmp.shift();
        if (tmp.length > 0) {
          for (j = 0, len1 = tmp.length; j < len1; j++) {
            s = tmp[j];
            nam2 += s[0].toUpperCase() + s.slice(1);
          }
        }
        opt = args[name] != null ? args[name] : args[nam2];
        if (opt != null) {
          url += `${nam2}=${opt}&`;
        }
      }
      url = url.replace(/.$/, '');
      // Connect to MongoDB
      self = this;
      mongodb = require('mongodb').MongoClient;
      mongodb.connect(url).then(function(client) {
        self.db = client.db(dbName);
        return self.col = self.db.collection(self.colName);
      }).catch(function(err) {
        return Error(err);
      });
    }

    available() {
      var self;
      self = this;
      return new Promise(function(resolve, reject) {
        return self.db.command({
          distinct: self.colName,
          key: '_id'
        }).then(function(res) {
          res = res.values;
          res.sort(function(a, b) {
            a = parseInt(a, 10);
            b = parseInt(b, 10);
            if (a === b) {
              return 0;
            } else if (a < b) {
              return -1;
            } else {
              return 1;
            }
          });
          return resolve(res);
        }).catch(function(err) {
          return reject(err);
        });
      });
    }

    lastCfg() {
      var self;
      self = this;
      return new Promise(function(resolve, reject) {
        return self.available().then(function(res) {
          return resolve(res.pop());
        }).catch(function(err) {
          return reject(err);
        });
      });
    }

    load(cfgNum, fields) {
      var self;
      self = this;
      return new Promise(function(resolve, reject) {
        return self.col.findOne({
          _id: cfgNum.toString()
        }).then(function(res) {
          var k, v;
          for (k in res) {
            v = res[k];
            if ((v.match != null) && v.match(/^{/)) {
              res[k] = JSON.parse(v);
            }
          }
          return resolve(res);
        }).catch(function(err) {
          return reject(err);
        });
      });
    }

  };

  module.exports = MongoConf;

}).call(this);
