(function() {
  /*
   * LemonLDAP::NG file configuration accessor for Node.js
   *
   * See README.md for license and copyright
   */
  var fileConf, fs;

  fs = require('fs');

  fileConf = class fileConf {
    constructor(args) {
      if (!(this.dirName = args.dirName)) {
        console.error("'dirName' is required in 'File' configuration type ! \n");
        return null;
      }
      if (!fs.lstatSync(this.dirName).isDirectory()) {
        console.error(`Directory ${this.dirName} doesn't exist\n`);
        return null;
      }
    }

    available() {
      var dir, q;
      dir = this.dirName;
      q = new Promise(function(resolve, reject) {
        return fs.readdir(dir, function(err, files) {
          var f, i, len, res;
          if (err) {
            return reject(err);
          } else {
            res = [];
            for (i = 0, len = files.length; i < len; i++) {
              f = files[i];
              if (f.match(/lmConf-(\d+)\.js/)) {
                res.push(RegExp.$1);
              }
            }
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
          }
        });
      });
      return q;
    }

    lastCfg() {
      var q, self;
      self = this;
      q = new Promise(function(resolve, reject) {
        return self.available().then(function(av) {
          return resolve(av.pop());
        }).catch(function(err) {
          return reject(err);
        });
      });
      return q;
    }

    //lock: ->
    //	fs.appendFileSync @dirName+'/lmConf.lock', 'lock'

      //isLocked: ->
    //	return fs.statSync(@dirName+'/lmConf.lock').isFile()

      //unlock: ->
    //	fs.unlink @dirName+'/lmConf.lock'

      //store: (fields) ->
    //	fs.writeFileSync "#{@dirName}/lmConf-#{fields.cfgNum}.js", JSON.stringify(fields)
    //	return fields.cfgNum
    load(cfgNum, fields) {
      var q, self;
      self = this;
      return q = new Promise(function(resolve, reject) {
        return fs.access(`${self.dirName}/lmConf-${cfgNum}.json`, fs.R_OK, function(err) {
          if (err) {
            return reject(`Unable to read ${self.dirName}/lmConf-${cfgNum}.js (${err})`);
          } else {
            return fs.readFile(`${self.dirName}/lmConf-${cfgNum}.json`, function(err, data) {
              if (err) {
                return reject(`Unable to read ${self.dirName}/lmConf-${cfgNum}.js (${err})`);
              } else {
                try {
                  return resolve(JSON.parse(data));
                } catch (error) {
                  err = error;
                  return reject(`JSON parsing error: ${err}`);
                }
              }
            });
          }
        });
      });
    }

  };

  //delete: (cfgNum) ->
  //	try
  //		fs.accessSync "#{@dirName}/lmConf-#{cfgNum}.js", fs.W_OK
  //	catch error
  //		console.error "Unable to access #{@dirName}/lmConf-#{cfgNum}.js (#{error})"
  //		return null
  //	fs.unlink "#{@dirName}/lmConf-#{fields.cfgNum}.js"
  //	1
  module.exports = fileConf;

}).call(this);
