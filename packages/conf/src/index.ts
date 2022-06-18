import type { LLNG_Conf, Conf_Accessor } from '@LLNG/types';

import fs from 'fs';
import ini from 'ini';
import crypto from '@LLNG/crypto';

export type LocalConf = {
  confFile: string | undefined;
  [key: string]: string | number | boolean | undefined;
};

type IniSection = {
  [key: string]: string | number;
}

type IniSection_Configuration = IniSection & {
  type: string;
}

type LLNG_IniSection = 'all' | 'configuration' | 'portal' | 'manager' | 'handler';

export type LLNG_IniFile = {
  [key in LLNG_IniSection]: IniSection | undefined;
}

class Conf {
  localConf: LocalConf;
  module: Conf_Accessor | undefined;

  constructor(args: LocalConf = {confFile: undefined}) {
    // @ts-ignore: confFile not yet defined
    this.localConf = args;
    this.localConf.cfgNum = 0;
    let confSection = <IniSection_Configuration>this.getLocalConf('configuration', false);
    if(confSection === undefined) throw new Error('Unknown error');
    if(!confSection.type) throw new Error('Configuration.type is missing in lemonldap-ng.ini');
    import(`@LLNG/conf-${confSection.type.toLowerCase()}`).then( (mod) => {
      this.module = new mod.default(confSection);
    }).catch( e => {
      throw new Error(e);
    });
  }

  getConf(args = {cfgNum: 0, raw: false}) {
    return new Promise<LLNG_Conf>( (resolve, reject) => {
      if( this.module === undefined ) return reject('Conf backend not initialized, please wait');
      this.module.lastCfg().then( (cn: number) => {
        args.cfgNum || (args.cfgNum = cn);
        if (!args.cfgNum) return reject("No configuration available");
        // @ts-ignore: this.module is defined
        this.module.load(args.cfgNum).then( rawConf => {
          if( typeof rawConf.key !== 'string' || !rawConf.key ) throw new Error('Key not defined in configuration');
          if (!args.raw) rawConf.cipher = new crypto(rawConf.key);
          resolve(rawConf);
        });
      });
    })
  }

  getLocalConf(section: LLNG_IniSection, loadDefault: boolean = false) {
    try {
      if (!this.localConf.confFile) this.localConf.confFile = process.env.LLNG_DEFAULTCONFFILE || '/etc/lemonldap-ng/lemonldap-ng.ini';
      let iniContent = <LLNG_IniFile>ini.parse(
        fs.readFileSync(this.localConf.confFile, 'utf-8')
        .replace(/\\\r?\n/g,'')
      );
      if (iniContent === undefined) throw new Error('Unable to get data from lemonldap-ng.ini');
      let res: IniSection = loadDefault && iniContent.all ? iniContent.all : {};
      if(iniContent[section] === undefined) return res;
      Object.keys(iniContent[section] as IniSection).forEach( k => {
        // @ts-ignore: iniContent[section] isn't undefined
        res[k] = iniContent[section][k];
      });
      return res;
    } catch(e) {
      throw new Error(`Unable to parse ${this.localConf.confFile}: ${e}`);
    }
  }

  saveConf(conf: LLNG_Conf, args = {force: undefined, cfgNumFixed: undefined}) {
    return new Promise<number>( (resolve, reject) => {
      if (this.module === undefined) return reject('Conf backend not initialized, please wait');
      this.module.lastCfg().then( last => {
        if (!args.force) {
          if (conf.cfgNum !== last) return -1;
          // TODO
          // if (this.module.isLocked() || !this.module.lock()) return -3;
        }
        if (!args.cfgNumFixed) {
          conf.cfgNum = last + 1;
        }
        delete conf.cipher;
        this.module!.store(conf).then(res => {
          if (!res) return reject('Unable to save conf');
          resolve(conf.cfgNum);
        })
      });
    });
  }
}

export default Conf;
