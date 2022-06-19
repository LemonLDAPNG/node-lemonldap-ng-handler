const session = require('..');
const fs = require('fs');
const path = require('path');

const cache = path.join(__dirname, 'cache');
const realcache = cache + '.node-llng-cache';

const id = 'bbbbbbbbbbbbbb';

const clean = () => {
  try {
    fs.rmSync( path.join( __dirname, id ) );
    fs.rmdirSync(realcache);
  }
  catch (e) {}
};

let sessionConn;


beforeAll( (done) => {
  clean();
  sessionConn = new session({
    storageModule: 'Apache::Session::File', 
    storageModuleOptions: { Directory: __dirname, },
    cacheModule: 'Cache::FileCache',
    cacheModuleOptions: {
      default_expires_in: 2,
      cache_root: cache,
    },
  });
  sessionConn.ready.then( () => {
    done()
  });
});

afterAll(() => {
  clean();
});

test('able to create session via update', (done) => {
  sessionConn.update({
    _session_id: id,
    f1: "field: 1",
    f2: "field: 2",
  }).then( res => {
    expect(res).toBeTruthy();
    sessionConn.get(id).then( session => {
      expect(session.f1).toEqual("field: 1");
      expect(session.f2).toEqual("field: 2");
      expect(sessionConn.inMemoryCache.get(id).f1).toEqual("field: 1");
      sessionConn.localCache.get(id).then( res => {
        expect(res.f1).toEqual("field: 1");
        done();
      });
    });
  })
  .catch( e => {
    throw new Error(e);
  });
});

test('able to get session', (done) => {
  sessionConn.get(id).then( session => {
    expect(session.f1).toEqual("field: 1");
    done();
  })
  .catch( e => {
    throw new Error(e);
  });
});

test('able to update session', (done) => {
  sessionConn.update({
    _session_id: id,
    f1: "field: 3",
    f2: "field: 4",
  }).then( res => {
    expect(res).toBeTruthy();
    sessionConn.get(id).then( session => {
      expect(session.f1).toEqual("field: 3");
      expect(session.f2).toEqual("field: 4");
      expect(sessionConn.inMemoryCache.get(id).f1).toEqual("field: 3");
      sessionConn.localCache.get(id).then( res => {
        expect(res.f1).toEqual("field: 3");
        done();
      });
    });
  })
  .catch( e => {
    throw new Error(e);
  });
});

test('localCache cleaned', (done) => {
  setTimeout(() => {
    sessionConn.localCache.get(id).then( res => {
      expect(res).toBeUndefined();
      done();
    });
  }, 2000);
}, 10000);
