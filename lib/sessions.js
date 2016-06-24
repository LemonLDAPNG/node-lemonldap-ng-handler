
/*
 *
 */

(function() {
  var init, newCache;

  newCache = function(args) {
    var fileCache, localCache;
    if (args == null) {
      args = {};
    }
    fileCache = require('file-cache-simple');
    args.cacheExpire = 600000;
    args.cacheDir || (args.cacheDir = '/tmp/llng');
    args.prefix = 'llng';
    return localCache = new fileCache(args);
  };

  init = function(args) {
    if (args == null) {
      args = {};
    }
  };

}).call(this);
