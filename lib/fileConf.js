
/*
 * LemonLDAP::NG file configuration accessor for Node.js
 *
 * See README.md for license and copyright
 */

(function() {
  var fileConf, fs;

  fs = require('fs');

  fileConf = (function() {
    function fileConf(args) {
      if (!(this.dirName = args.dirName)) {
        console.error("'dirName' is required in 'File' configuration type ! \n");
        return null;
      }
      if (!fs.lstatSync(this.dirName).isDirectory()) {
        console.error("Directory " + this.dirName + " doesn't exist\n");
        return null;
      }
    }

    fileConf.prototype.available = function() {
      var dir, q;
      dir = this.dirName;
      q = new Promise(function(resolve, reject) {
        return fs.readdir(dir, function(err, files) {
          var f, i, len, ref, res;
          if (err) {
            return reject(err);
          } else {
            res = [];
            ref = files.sort();
            for (i = 0, len = ref.length; i < len; i++) {
              f = ref[i];
              if (f.match(/lmConf-(\d+)\.js/)) {
                res.push(RegExp.$1);
              }
            }
            return resolve(res);
          }
        });
      });
      return q;
    };

    fileConf.prototype.lastCfg = function() {
      var q, self;
      self = this;
      q = new Promise(function(resolve, reject) {
        return self.available().then(function(av) {
          return resolve(av.pop());
        })["catch"](function(err) {
          return reject(err);
        });
      });
      return q;
    };

    fileConf.prototype.load = function(cfgNum, fields) {
      var q, self;
      self = this;
      return q = new Promise(function(resolve, reject) {
        return fs.access(self.dirName + "/lmConf-" + cfgNum + ".json", fs.R_OK, function(err) {
          if (err) {
            return reject("Unable to read " + self.dirName + "/lmConf-" + cfgNum + ".js (" + err + ")");
          } else {
            return fs.readFile(self.dirName + "/lmConf-" + cfgNum + ".json", function(err, data) {
              var error;
              if (err) {
                return reject("Unable to read " + self.dirName + "/lmConf-" + cfgNum + ".js (" + err + ")");
              } else {
                try {
                  return resolve(JSON.parse(data));
                } catch (error) {
                  err = error;
                  return reject("JSON parsing error: " + err);
                }
              }
            });
          }
        });
      });
    };

    return fileConf;

  })();

  module.exports = fileConf;

}).call(this);
