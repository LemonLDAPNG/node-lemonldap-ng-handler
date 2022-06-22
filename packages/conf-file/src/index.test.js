'use strict'

const FileConf = require('../')

const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname, 'conf')

let fileConfs

const clean = () => {
  try {
    fs.rmSync(dir, { recursive: true })
  } catch (e) {
    //console.error(e)
  }
}

describe('File configuration', () => {
  beforeAll(async () => {
    clean()

    fs.mkdirSync(dir)
    fileConfs = new FileConf({
      dirName: dir
    })
  })
  afterAll(clean)

  describe('when no configuration available', () => {
    it('available() should return an empty array when no configuration available', () => {
      expect(fileConfs.available()).resolves.toEqual([])
    })

    it('lastCfg() should throw', () => {
      expect(fileConfs.lastCfg()).rejects.toEqual('No configuration available')
    })
  })

  describe('when configuration available', () => {
    it('should store new conf', () => {
      expect(
        fileConfs.store({
          cfgNum: 1,
          f1: 'field 1'
        })
      ).resolves.toBeTrue
    })

    it('should find 1 available configuration', () => {
      expect(fileConfs.available()).resolves.toEqual([1])
    })

    it('should return "1" as last available configuration', () => {
      expect(fileConfs.lastCfg()).resolves.toEqual(1)
    })
    it('should read new conf', () => {
      expect(fileConfs.load(1)).resolves.toEqual({ cfgNum: 1, f1: 'field 2' })
    })

    it('should store updated conf', () => {
      expect(
        fileConfs.store({
          cfgNum: 1,
          f1: 'field 2'
        })
      ).resolves.toBeTrue
    })

    it('should read updated conf', () => {
      expect(fileConfs.load(1)).resolves.toEqual({ cfgNum: 1, f1: 'field 2' })
    })

    it('should find 1 available configuration', () => {
      expect(fileConfs.available()).resolves.toEqual([1])
    })

    it('should return "1" as last available configuration', done => {
      fileConfs.lastCfg().then(res => {
        expect(res).toEqual(1)
        done()
      })
      // Unusable here, else afterClean is launched before test ends
      // See https://github.com/facebook/jest/issues/12957
      //expect(fileConfs.lastCfg()).resolves.toEqual(1)
    })
  })
})
