var assert = require('assert');
var obj;

describe('Functions tests', function() {
  var array;
  it('should load library', function() {
    var m = require('../lib/handlerConf');
    obj = new m({configStorage:{"confFile": "test/lemonldap-ng.ini"}});
  });
  it('should provide basic()', function() {
    array = obj.conditionSub('basic($u, $p)');
    assert.equal( array[0](null,{u:"é",p:"à"}), 'Basic 6Trg');
  });
  it('checkDate should return true or false', function() {
    array = obj.conditionSub('checkDate(1,99999999999999)');
    assert.equal( array[0](), true );
    array = obj.conditionSub('checkDate(1,20171231140000)');
    assert.equal( array[0](), false );
  });
  it('should provide isInNet6', function() {
    array = obj.conditionSub('isInNet6($i,$net)');
    assert.equal( array[0](null,{i:"2018::1",net:"2000::0/11"}), true);
    assert.equal( array[0](null,{i:"2018::1",net:"2000::0/12"}), false);
  });
  it('should provide encrypt', function() {
    array = obj.conditionSub('encrypt($s)');
    assert.equal( array[0](null,{s:"a"}), 'vQ2pr1y64icsdZPtKD9/DQ==');
  });
});
