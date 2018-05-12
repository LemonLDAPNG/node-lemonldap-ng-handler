var assert = require('assert');
var obj;

describe('Functions tests', function() {
  it('should load library', function() {
    var m = require('../lib/handlerConf');
    obj = new m({configStorage:{"confFile": "test/lemonldap-ng.ini"}});
  });
  it('should provides basic()', function() {
    //obj.basic('é:à').should.equal('6Trg');
    array = obj.conditionSub('basic("é", "à")');
    assert.equal( array[0](), 'Basic 6Trg');
    //array[0]().should.equal('6Trg');
  });
});
