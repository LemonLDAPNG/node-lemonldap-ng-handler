import {
  LLNG_Conf,
  Conf_Accessor,
  LocalConf,
  IniSection_Configuration,
  LLNG_IniSection,
  LLNG_IniFile,
  IniSection,
} from "@lemonldap-ng/types";

type getConf_Args = {
  cfgNum?: number;
  raw?: boolean;
};

import fs from "fs";
import ini from "ini";
import crypto from "@lemonldap-ng/crypto";

class Conf {
  localConf: LocalConf;
  module: Conf_Accessor | undefined;
  ready: Promise<boolean>;

  constructor(args: LocalConf = { confFile: undefined }) {
    // @ts-ignore: confFile not yet defined
    this.localConf = args;
    this.localConf.cfgNum = 0;
    const confSection = <IniSection_Configuration>(
      this.getLocalConf("configuration", false)
    );
    if (confSection === undefined) throw new Error("Unknown error");
    if (!confSection.type)
      // istanbul ignore next
      throw new Error("Configuration.type is missing in lemonldap-ng.ini");
    this.ready = new Promise<boolean>((resolve, reject) => {
      import(`@lemonldap-ng/conf-${confSection.type.toLowerCase()}`)
        .then((mod) => {
          const cl = mod.default;
          this.module = new cl(confSection);
          resolve(true);
        })
        .catch((e) => {
          // istanbul ignore next
          reject(e);
        });
    });
  }

  getConf(args: getConf_Args = {}) {
    return new Promise<LLNG_Conf>((resolve, reject) => {
      if (this.module === undefined)
        // istanbul ignore next
        return reject("Conf backend not initialized, please wait");
      this.module.lastCfg().then((cn: number) => {
        args.cfgNum || (args.cfgNum = cn);
        if (!args.cfgNum) return reject("No configuration available");
        // @ts-ignore: this.module is defined
        this.module.load(args.cfgNum).then((rawConf) => {
          if (!rawConf.key || typeof rawConf.key !== "string") {
            // istanbul ignore next
            // Key is required for encryption but missing in configuration
            rawConf.key = "";
          }
          // @ts-ignore
          if (!args.raw) rawConf.cipher = new crypto(rawConf.key);
          resolve(rawConf);
        });
      });
    });
  }

  getLocalConf(section: LLNG_IniSection, loadDefault: boolean = false) {
    try {
      if (!this.localConf.confFile)
        // istanbul ignore next
        this.localConf.confFile =
          process.env.LLNG_DEFAULTCONFFILE ||
          "/etc/lemonldap-ng/lemonldap-ng.ini";
      const iniContent = <LLNG_IniFile>(
        ini.parse(
          fs
            .readFileSync(this.localConf.confFile, "utf-8")
            .replace(/\\\r?\n/g, ""),
        )
      );
      if (iniContent === undefined)
        // istanbul ignore next
        throw new Error("Unable to get data from lemonldap-ng.ini");
      const res: IniSection =
        loadDefault && iniContent.all ? iniContent.all : {};
      if (iniContent[section] === undefined) return res;
      Object.keys(iniContent[section] as IniSection).forEach((k) => {
        // @ts-ignore: iniContent[section] isn't undefined
        res[k] = iniContent[section][k];
      });
      return res;
    } catch (e) {
      throw new Error(`Unable to parse ${this.localConf.confFile}: ${e}`);
    }
  }

  saveConf(
    conf: LLNG_Conf,
    args = { force: undefined, cfgNumFixed: undefined },
  ) {
    return new Promise<number>((resolve, reject) => {
      if (this.module === undefined)
        return reject("Conf backend not initialized, please wait");
      this.module.lastCfg().then((last) => {
        if (!args.force) {
          if (conf.cfgNum !== last) return -1;
          // TODO
          // if (this.module.isLocked() || !this.module.lock()) return -3;
        }
        if (!args.cfgNumFixed) {
          conf.cfgNum = last + 1;
        }
        delete conf.cipher;
        this.module!.store(conf).then((res) => {
          if (!res) return reject("Unable to save conf");
          resolve(conf.cfgNum);
        });
      });
    });
  }
}

export default Conf;
