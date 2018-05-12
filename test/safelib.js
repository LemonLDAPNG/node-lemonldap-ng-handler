var assert = require('assert');
var obj;

describe('Functions tests', function() {
  var array;
  it('should load library', function() {
    var m = require('../lib/handlerConf');
    obj = new m({configStorage:{"confFile": "test/lemonldap-ng.ini"}});
  });
  it('should provide basic()', function() {
    array = obj.conditionSub('basic("é", "à")');
    assert.equal( array[0](), 'Basic 6Trg');
  });
  it('checkDate should return true or false', function() {
    array = obj.conditionSub('checkDate(1,99999999999999)');
    assert.equal( array[0](), true );
    array = obj.conditionSub('checkDate(1,20171231140000)');
    assert.equal( array[0](), false );
  });
});
