"use strict";

const FileConf = require("../");

const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "conf");

let fileConfs;

const clean = () => {
  try {
    fs.rmSync(dir, { recursive: true });
  } catch (e) {
    console.debug(e);
  }
};

describe("File configuration", () => {
  beforeAll(async () => {
    clean();

    fs.mkdirSync(dir);
    fileConfs = new FileConf({
      dirName: dir,
    });
  });
  afterAll(clean);

  describe("when no configuration available", () => {
    it("available() should return an empty array when no configuration available", () => {
      return expect(fileConfs.available()).resolves.toEqual([]);
    });

    it("lastCfg() should throw", () => {
      return expect(fileConfs.lastCfg()).rejects.toEqual(
        "No configuration available",
      );
    });
  });

  describe("when configuration available", () => {
    it("should store new conf", () => {
      return expect(
        fileConfs.store({
          cfgNum: 1,
          f1: "field 1",
        }),
      ).resolves.toBeTrue;
    });

    it("should find 1 available configuration", () => {
      return expect(fileConfs.available()).resolves.toEqual([1]);
    });

    it('should return "1" as last available configuration', () => {
      return expect(fileConfs.lastCfg()).resolves.toEqual(1);
    });
    it("should read new conf", () => {
      return expect(fileConfs.load(1)).resolves.toEqual({
        cfgNum: 1,
        f1: "field 1",
      });
    });

    it("should store updated conf", () => {
      return expect(
        fileConfs.store({
          cfgNum: 1,
          f1: "field 2",
        }),
      ).resolves.toBeTrue;
    });

    it("should read updated conf", () => {
      return expect(fileConfs.load(1)).resolves.toEqual({
        cfgNum: 1,
        f1: "field 2",
      });
    });

    it("should find 1 available configuration", () => {
      return expect(fileConfs.available()).resolves.toEqual([1]);
    });

    it('should return "1" as last available configuration', () => {
      return expect(fileConfs.lastCfg()).resolves.toEqual(1);
    });
  });
});
