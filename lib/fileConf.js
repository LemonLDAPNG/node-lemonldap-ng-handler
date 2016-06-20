(function() {
  exports.fs = require('fs');

  exports.init = function(args) {
    if (!(exports.dirName = args.dirName)) {
      console.log("'dirName' is required in 'File' configuration type ! \n");
      return null;
    }
    if (!exports.fs.lstatSync(exports.dirName).isDirectory()) {
      console.log("Directory " + exports.dirName + " doesn't exist\n");
      return null;
    }
    return exports;
  };

  exports.available = function() {
    var f, i, len, ref, res;
    res = [];
    ref = exports.fs.readdirSync(exports.dirName).sort();
    for (i = 0, len = ref.length; i < len; i++) {
      f = ref[i];
      if (f.match(/lmConf-(\d+)\.js/)) {
        res.push(RegExp.$1);
      }
    }
    return res;
  };

  exports.lastCfg = function() {
    return exports.available().pop();
  };

  exports.lock = function() {
    return exports.fs.appendFileSync(exports.dirName + '/lmConf.lock', 'lock');
  };

  exports.isLocked = function() {
    return exports.fs.statSync(exports.dirName + '/lmConf.lock').isFile();
  };

  exports.unlock = function() {
    return exports.fs.unlink(exports.dirName + '/lmConf.lock');
  };

  exports.store = function(fields) {
    exports.fs.writeFileSync(exports.dirName + "/lmConf-" + fields.cfgNum + ".js", JSON.stringify(fields));
    return fields.cfgNum;
  };

  exports.load = function(cfgNum, fields) {
    var data, error, error1, error2;
    try {
      exports.fs.accessSync(exports.dirName + "/lmConf-" + cfgNum + ".js", exports.fs.R_OK);
    } catch (error1) {
      error = error1;
      console.log("Unable to read " + exports.dirName + "/lmConf-" + cfgNum + ".js (" + error + ")");
      return null;
    }
    data = exports.fs.readFileSync(exports.dirName + "/lmConf-" + cfgNum + ".js");
    try {
      return JSON.parse(data);
    } catch (error2) {
      error = error2;
      console.log("JSON parsing error: " + error);
      return null;
    }
  };

  exports["delete"] = function(cfgNum) {
    var error, error1;
    try {
      exports.fs.accessSync(exports.dirName + "/lmConf-" + cfgNum + ".js", exports.fs.W_OK);
    } catch (error1) {
      error = error1;
      console.log("Unable to access " + exports.dirName + "/lmConf-" + cfgNum + ".js (" + error + ")");
      return null;
    }
    exports.fs.unlink(exports.dirName + "/lmConf-" + fields.cfgNum + ".js");
    return 1;
  };

}).call(this);
