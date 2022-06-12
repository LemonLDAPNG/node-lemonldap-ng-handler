'use strict';

const YAMLConf = require('../');

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const dir = path.join(__dirname,'conf');

let yamlConfs;

const clean = () => {
  try {
    rimraf(dir, () => {})
  }
  catch (e) {console.error(e)}
};

beforeAll( async () => {
  clean();

  await mkdirp(dir);
  yamlConfs = new YAMLConf({dirName: dir});
});

afterAll(clean);

test('store new conf', (done) => {
  yamlConfs.store({cfgNum: 1, f1: 'field 1'})
  .then( res => {
    expect(res).toBeTrue;
    done();
  });
});

test('read new conf', (done) => {
  yamlConfs.load(1).then( res => {
    expect(res.f1).toEqual('field 1');
    done();
  })
  .catch( e => { console.error(e) });
});

test('store updated conf', (done) => {
  yamlConfs.store({cfgNum: 1, f1: 'field 2'})
  .then( res => {
    expect(res).toBeTrue;
    done();
  });
});

test('read updated conf', (done) => {
  yamlConfs.load(1).then( res => {
    expect(res.f1).toEqual('field 2');
    done();
  })
  .catch( e => { console.error(e) });
});

test('available', (done) => {
  yamlConfs.available().then(res => {
    expect(res).toEqual([1]);
    done();
  });
});

test('lastCfg', (done) => {
  yamlConfs.lastCfg().then(res => {
    expect(res).toEqual(1);
    done();
  });
});
