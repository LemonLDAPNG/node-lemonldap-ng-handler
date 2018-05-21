var assert = require('assert');
var obj;

describe('Functions tests', function() {
  var array, vm;
  it('should load library', function() {
    var m = require('../lib/handlerConf');
    obj = new m({configStorage:{"confFile": "test/lemonldap-ng.ini"}});
    vm = obj.newSafe()
  });
  it('should provide basic()', function() {
    array = obj.conditionSub('basic($u, $p)', vm);
    assert.equal( array[0](null,{u:"é",p:"à"}), 'Basic 6Trg');
  });
  it('checkDate should return true or false', function() {
    array = obj.conditionSub('checkDate(1,99999999999999)', vm);
    assert.equal( array[0](), true );
    array = obj.conditionSub('checkDate(1,20171231140000)', vm);
    assert.equal( array[0](), false );
  });
  it('should provide isInNet6', function() {
    array = obj.conditionSub('isInNet6($i,$net)', vm);
    assert.equal( array[0](null,{i:"2018::1",net:"2000::0/11"}), true);
    assert.equal( array[0](null,{i:"2018::1",net:"2000::0/12"}), false);
  });
  it('should provide encrypt', function() {
    array = obj.conditionSub('encrypt($s)', vm);
    assert.equal( array[0](null,{s:"a"}), 'vQ2pr1y64icsdZPtKD9/DQ==');
  });
  it('should provide token', function() {
    array = obj.conditionSub('token($sa,$sb)', vm);
    var val = array[0](null,{sa:"a",sb:"b"});
    var s = obj.tsv.cipher.decrypt(val);
    var a = s.split(':');
    assert.equal(a[1],'a');
    assert.equal(a[2],'b');
  });
  it('should provide encode_base64', function() {
    array = obj.conditionSub('encode_base64("aaa")', vm);
    assert.equal( array[0](), 'YWFh' );
  });
});
