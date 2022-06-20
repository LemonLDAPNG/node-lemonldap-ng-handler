import Crypto from '@LLNG/crypto';

/* LemonLDAP::NG configuration */

/* Backends options */
declare type Backend_Options = {
  [k: string]: string | number | boolean | { [k: string]: string | boolean | number },
};

/* Lemonldap::NG configuration (stored into database */
declare type LLNG_Conf = {
  cfgNum: number;
  cipher: Crypto | undefined;
  globalStorage: string | undefined;
  globalStorageOptions: Backend_Options;
  exportedHeaders?: { [k: string]: string };
  [key: string]: object | any[] | string | number | boolean;
}

export interface Conf_Accessor {
  available(): Promise<number[]>;
  lastCfg(): Promise<number>;
  store(conf: LLNG_Conf): Promise<boolean>;
  load(cfgNum: number, fields: string[] = []): Promise<LLNG_Conf>;
}

/* Sessions interfaces */

/* LemonLDAP::Session */
export interface LLNG_Session {
  _session_id: string;
  _logout?: string;
  _utime: number;
  _lastSeen?: number;
  [key: string]: string | number | boolean;
}

/* Sessions stored into sessions DB (Apache::Session format) */
declare type Apache_Session = {
  id: string;
  a_session: string;
}

/* @LLNG/session-* classes */
export interface Session_Accessor {
  get(id: string): Promise<LLNG_Session>;
  update(data: LLNG_Session): Promise<boolean>;
}

/* local config */

export type LocalConf = {
  confFile?: string | undefined;
  [key: string]: string | number | boolean | object | undefined;
};

export type IniSection = {
  localStorage?: string;
  localStorage?: string;
  [key: string]: string | number | object;
}

export type IniSection_Configuration = IniSection & {
  type: string;
  localStorageOptions?: {
    cache_root?: string;
    default_expires_in?: number;
  },
  [key: string]: string | number | object;
};

export type IniSection_NodeHandler = IniSection & {
  nodeVhosts: string;
};

export type LLNG_IniSection = 'all' | 'configuration' | 'portal' | 'manager' | 'handler' | 'node-handler';

export type LLNG_IniFile = {
  all: IniSection;
  configuration: IniSection_Configuration;
  portal?: IniSection;
  handler?: IniSection;
  manager?: IniSection;
  'node-handler'?: IniSection;
}