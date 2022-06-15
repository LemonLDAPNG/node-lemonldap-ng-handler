(function() {
  /*
   * LemonLDAP::NG crypto module for Node.js/express
   *
   * See README.md for license and copyright
   */
  var Crypto, aesjs, rnd, sha;

  rnd = require('random-bytes');

  sha = require('sha.js');

  aesjs = require('aes-js');

  Crypto = class Crypto {
    constructor(key, mode) {
      this.mode = mode;
      this.rk = new sha('sha256').update(key).digest();
    }

    newIv() {
      var tmp;
      tmp = rnd.sync(16);
      return Buffer.from(Array.prototype.slice.call(tmp, 0));
    }

    encrypt(s) {
      var buf, cipher, hmac, iv, l, res;
      s = Buffer.from(s);
      l = 16 - s.length % 16;
      s = Buffer.concat([s, Buffer.allocUnsafe(l).fill("\0")]);
      hmac = new sha('sha256').update(s).digest();
      s = Buffer.concat([hmac, s]);
      iv = this.newIv();
      cipher = new aesjs.ModeOfOperation.cbc(this.rk, iv);
      buf = Buffer.concat([iv, cipher.encrypt(s)]);
      res = Buffer.from(buf).toString('base64');
      return res;
    }

    decrypt(s) {
      var cipher, hmac, iv, newhmac, res, z;
      s = s.replace(/%2B/g, '+').replace(/%2F/g, '/').replace(/%3D/g, '=').replace(/%0A/g, "\n");
      s = Buffer.from(s, 'base64');
      iv = s.slice(0, 16);
      s = s.slice(16);
      cipher = new aesjs.ModeOfOperation.cbc(this.rk, iv);
      res = Buffer.from(cipher.decrypt(s));
      hmac = res.slice(0, 32);
      res = res.slice(32);
      newhmac = new sha('sha256').update(res).digest();
      z = res.indexOf("\0");
      if (z > 0) {
        res = res.slice(0, z + 1);
      }
      res = res.toString();
      // Remove \0 at end
      res = res.substring(0, res.length - 1);
      if (hmac.equals(newhmac)) {
        return res;
      } else {
        console.error("Bad hmac");
        return res;
      }
    }

  };

  module.exports = Crypto;

}).call(this);
