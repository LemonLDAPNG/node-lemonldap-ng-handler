'use strict'

const FileConf = require('../')

const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const mkdirp = require('mkdirp')
const dir = path.join(__dirname, 'conf')

let fileConfs

const clean = () => {
  try {
    rimraf(dir, () => {})
  } catch (e) {
    console.error(e)
  }
}

beforeAll(async () => {
  clean()

  await mkdirp(dir)
  fileConfs = new FileConf({
    dirName: dir
  })
})

afterAll(clean)

test('store new conf', done => {
  fileConfs
    .store({
      cfgNum: 1,
      f1: 'field 1'
    })
    .then(res => {
      expect(res).toBeTrue
      done()
    })
})

test('read new conf', done => {
  fileConfs
    .load(1)
    .then(res => {
      expect(res.f1).toEqual('field 1')
      done()
    })
    .catch(e => {
      console.error(e)
    })
})

test('store updated conf', done => {
  fileConfs
    .store({
      cfgNum: 1,
      f1: 'field 2'
    })
    .then(res => {
      expect(res).toBeTrue
      done()
    })
})

test('read updated conf', done => {
  fileConfs
    .load(1)
    .then(res => {
      expect(res.f1).toEqual('field 2')
      done()
    })
    .catch(e => {
      console.error(e)
    })
})

test('available', done => {
  fileConfs.available().then(res => {
    expect(res).toEqual([1])
    done()
  })
})

test('lastCfg', done => {
  fileConfs.lastCfg().then(res => {
    expect(res).toEqual(1)
    done()
  })
})
