(function() {
  var assert, crypto;

  assert = require('assert');

  crypto = require('../lib/crypto');

  crypto = new crypto('qwertyui');

  describe('Crypto test', function() {
    var data;
    data = require('./cr.json');
    it('should decrypt its encrypted data', function() {
      var k, results, s, v;
      results = [];
      for (k in data) {
        v = data[k];
        s = crypto.encrypt(k);
        results.push(assert.equal(k, crypto.decrypt(s)));
      }
      return results;
    });
    return it('should encode like Perl libraries', function() {
      var k, results, v;
      results = [];
      for (k in data) {
        v = data[k];
        results.push(assert.equal(k, crypto.decrypt(v)));
      }
      return results;
    });
  });

}).call(this);
