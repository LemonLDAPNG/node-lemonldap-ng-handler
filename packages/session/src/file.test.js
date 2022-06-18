const session = require('..');
const fs = require('fs');
const path = require('path');

const clean = () => {
  try {
  }
  catch (e) {}
};

let sessionConn;


beforeAll( () => {
  sessionConn = new session('Apache::Session::File', {Directory: __dirname});
});

afterAll(() => {
  fs.rmSync( path.join( __dirname, "aaaaaaaaaaaa" ) );
});

test('able to update session', (done) => {
  sessionConn.update({
    _session_id: "aaaaaaaaaaaa",
    f1: "field: 1",
    f2: "field: 2",
  }).then( res => {
    expect(res).toBeTruthy();
    sessionConn.get('aaaaaaaaaaaa').then( session => {
      expect(session.f1).toEqual("field: 1");
      expect(session.f2).toEqual("field: 2");
      done();
    });
  })
  .catch( e => {
    throw new Error(e);
  });
});

test('able to get session', (done) => {
  sessionConn.get('aaaaaaaaaaaa').then( session => {
    expect(session.f1).toEqual("field: 1");
    done();
  })
  .catch( e => {
    throw new Error(e);
  });
});
