
/*
 * LemonLDAP::NG file configuration accessor for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var fileConf;

  fileConf = (function() {
    function fileConf() {}

    fileConf.prototype.fs = require('fs');

    fileConf.prototype.init = function(args) {
      if (!(this.dirName = args.dirName)) {
        console.log("'dirName' is required in 'File' configuration type ! \n");
        return null;
      }
      if (!this.fs.lstatSync(this.dirName).isDirectory()) {
        console.log("Directory " + this.dirName + " doesn't exist\n");
        return null;
      }
      return this;
    };

    fileConf.prototype.available = function() {
      var f, i, len, ref, res;
      res = [];
      ref = this.fs.readdirSync(this.dirName).sort();
      for (i = 0, len = ref.length; i < len; i++) {
        f = ref[i];
        if (f.match(/lmConf-(\d+)\.js/)) {
          res.push(RegExp.$1);
        }
      }
      return res;
    };

    fileConf.prototype.lastCfg = function() {
      return this.available().pop();
    };

    fileConf.prototype.lock = function() {
      return this.fs.appendFileSync(this.dirName + '/lmConf.lock', 'lock');
    };

    fileConf.prototype.isLocked = function() {
      return this.fs.statSync(this.dirName + '/lmConf.lock').isFile();
    };

    fileConf.prototype.unlock = function() {
      return this.fs.unlink(this.dirName + '/lmConf.lock');
    };

    fileConf.prototype.store = function(fields) {
      this.fs.writeFileSync(this.dirName + "/lmConf-" + fields.cfgNum + ".js", JSON.stringify(fields));
      return fields.cfgNum;
    };

    fileConf.prototype.load = function(cfgNum, fields) {
      var data, error, error1, error2;
      try {
        this.fs.accessSync(this.dirName + "/lmConf-" + cfgNum + ".js", this.fs.R_OK);
      } catch (error1) {
        error = error1;
        console.log("Unable to read " + this.dirName + "/lmConf-" + cfgNum + ".js (" + error + ")");
        return null;
      }
      data = this.fs.readFileSync(this.dirName + "/lmConf-" + cfgNum + ".js");
      try {
        return JSON.parse(data);
      } catch (error2) {
        error = error2;
        console.log("JSON parsing error: " + error);
        return null;
      }
    };

    fileConf.prototype["delete"] = function(cfgNum) {
      var error, error1;
      try {
        this.fs.accessSync(this.dirName + "/lmConf-" + cfgNum + ".js", this.fs.W_OK);
      } catch (error1) {
        error = error1;
        console.log("Unable to access " + this.dirName + "/lmConf-" + cfgNum + ".js (" + error + ")");
        return null;
      }
      this.fs.unlink(this.dirName + "/lmConf-" + fields.cfgNum + ".js");
      return 1;
    };

    return fileConf;

  })();

  module.exports = new fileConf();

}).call(this);
