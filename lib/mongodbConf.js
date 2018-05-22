(function() {
  /*
   * LemonLDAP::NG MongoDB configuration accessor for Node.js
   *
   * See README.md for license and copyright
   */
  var MongoConf, mongodb;

  mongodb = require('mongodb').MongoClient;

  MongoConf = class MongoConf {
    constructor(args) {
      var dbName, self, url;
      dbName = args.dbName || 'llConfDB';
      this.colName = args.collectionName || 'configuration';
      url = `mongodb://${args.host || '127.0.0.1'}:${args.port || '27017'}`;
      self = this;
      mongodb.connect(url).then(function(client) {
        self.db = client.db(dbName);
        return self.col = self.db.collection(self.colName);
      }).catch(function(err) {
        return console.error(err);
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
