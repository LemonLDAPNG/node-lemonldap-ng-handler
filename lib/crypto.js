
/*
 * LemonLDAP::NG crypto module for Node.js/express
 *
 * See README.md for license and copyright
 */

(function() {
  var Crypto;

  Crypto = (function() {
    function Crypto(key, mode) {
      var MD5, h, v;
      this.mode = mode;
      MD5 = require('js-md5');
      h = MD5.create();
      h.update(key);
      this.aesjs = require('aes-js');
      this.iv = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      this.rk = h.digest();
      this.tob = this.aesjs.utils.utf8.toBytes;
      this.frb = this.aesjs.utils.utf8.fromBytes;
      v = this.encrypt('aa');
      console.log('RES1', v);
      console.log('RES', this.decrypt(v));
    }

    Crypto.prototype.encrypt = function(s) {
      var buf, cipher, l;
      l = 16 - s.length % 16;
      s = s.padEnd(s.length + l, "\0");
      cipher = new this.aesjs.ModeOfOperation.cbc(this.rk, this.iv);
      buf = cipher.encrypt(this.tob(s));
      return new Buffer(buf).toString('base64');
    };

    Crypto.prototype.decrypt = function(s) {
      var cipher, res;
      s = Buffer.from(s, 'base64');
      cipher = new this.aesjs.ModeOfOperation.cbc(this.rk, this.iv);
      res = this.frb(cipher.decrypt(s));
      return res = res.replace(/\0/g, '');
    };

    return Crypto;

  })();

  module.exports = Crypto;

}).call(this);
