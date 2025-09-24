export type LDAP_Args = {
  ldapServer: string;
  ldapConfBase: string;
  ldapBindDN: string;
  ldapBindPassword: string;
  ldapObjectClass: string | undefined;
  ldapAttributeId: string | undefined;
  ldapAttributeContent: string | undefined;
  ldapCAFile: string | undefined;
};

import { Client as LDAPClient } from "ldapts";
import type {
  SearchOptions,
  Entry,
} from "ldapts";
import { LLNG_Conf, Conf_Accessor } from "@lemonldap-ng/types";
import fs from "fs";

const requiredArgs = [
  "ldapServer",
  "ldapConfBase",
  "ldapBindDN",
  "ldapBindPassword",
];

class LDAPConf implements Conf_Accessor {
  /* properties */
  ldapServer: string;
  base: string;
  dn: string;
  pwd: string;
  objClass: string;
  idAttr: string;
  contentAttr: string;
  caConf: { ca: string[] } | undefined;
  client: LDAPClient;
  ldapCa: string;

  constructor(args: LDAP_Args) {
    // Check for required args
    requiredArgs.forEach((v) => {
      // @ts-ignore
      if (!args[v]) throw new Error(`argument ${v} is required`);
    });
    this.ldapServer = args.ldapServer.match(/^ldap/)
      ? args.ldapServer
      : `ldap://${args.ldapServer}`;
    this.base = args.ldapConfBase;
    this.dn = args.ldapBindDN;
    this.pwd = args.ldapBindPassword;
    this.objClass = args.ldapObjectClass || "applicationProcess";
    this.idAttr = args.ldapAttributeId || "cn";
    this.contentAttr = args.ldapAttributeContent || "description";
    this.ldapCa = args.ldapServer.match(/^ldaps/) ? args.ldapCAFile || "" : "";
    if (this.ldapCa !== "") {
      try {
        this.caConf = {
          ca: [fs.readFileSync(this.ldapCa).toString()],
        };
      } catch (error) {
        throw new Error(`Unable to parse ${this.ldapCa}: ${error}`);
      }
    }
    this.client = new LDAPClient({
      tlsOptions: this.caConf,
      url: this.ldapServer,
    });
  }

  available() {
    return new Promise<number[]>((resolve, reject) => {
      this.client.bind(this.dn, this.pwd)
        .then(() => {
          const data: number[] = [];
          const opt: SearchOptions = {
            filter: `(objectClass=${this.objClass})`,
            scope: "sub",
            attributes: [this.idAttr],
          };
          this.client.search(
            this.base,
            opt,
          )
            .then((res) => {
              res.searchEntries.forEach((entry: Entry) => {
                let val = entry[this.idAttr].toString();
                if (typeof val === "object") val = val[0];
                data.push(parseInt(val.replace(/lmConf-/, ""), 10));
              });
              resolve(data.sort());
            })
            .catch((err) => reject(`LDAP search failed: ${err}`));
        })
        .catch((err) => reject(`LDAP bind failed: ${err}`));
    });
  }

  lastCfg() {
    return new Promise<number>((resolve, reject) => {
      this.available()
        .then((av: number[]) => {
          if (av.length > 0) {
            // @ts-ignore
            resolve(av.pop());
          } else {
            reject("No configuration available");
          }
        })
        .catch((err) => reject(err));
    });
  }

  // eslint-disable-next-line no-unused-vars
  load(cfgNum: number, fields: string[] = []) {
    return new Promise<LLNG_Conf>((resolve, reject) => {
      this.client.bind(this.dn, this.pwd)
        .then(() => {
          const opt: SearchOptions = {
            filter: `(objectClass=${this.objClass})`,
            scope: "sub",
          };
          this.client.search(
            `${this.idAttr}=lmConf-${cfgNum},${this.base}`,
            opt,
          )
            .then((res) => {
              let data: string[] = [];
              // @ts-ignore: cfgNum initialized later
              const conf: LLNG_Conf = {};
              res.searchEntries.forEach((entry: Entry) => {
                let tmp: string | string[] | Buffer<ArrayBufferLike> | Buffer<ArrayBufferLike>[] = entry[this.contentAttr];
                if (!Array.isArray(tmp)) tmp = [tmp as string];
                data = tmp.map((item): string =>
                  typeof item === "string"
                    ? item
                    : typeof item === "number"
                    ? (item as number).toString()
                    : Buffer.isBuffer(item)
                    ? item.toString()
                    : (item as unknown) instanceof Uint8Array
                    ? Buffer.from(item).toString()
                    : (item as string)?.toString()
                  );
              });
              data.forEach((confLine: string) => {
                if (!confLine.match(/^\{(.*?)\}(.*)/)) {
                  return reject(`Bad conf line: ${confLine}`);
                }
                const k = RegExp.$1;
                const v = RegExp.$2;
                if (v.match !== null && v.match(/^{/)) {
                  conf[k] = JSON.parse(v);
                } else {
                  conf[k] = v;
                }
              });
              return resolve(conf);
            })
            .catch((err) => reject(`LDAP search failed: ${err}`));
        })
        .catch((err) => reject(`LDAP bind failed: ${err}`));
    });
  }

  // eslint-disable-next-line no-unused-vars
  loadCb(cfgNum: number, fields: string[] = []) {
    return new Promise<LLNG_Conf>((resolve, reject) => {
      this.client.bind(this.dn, this.pwd)
      .then(() => {
        const opt: SearchOptions = {
          filter: `(objectClass=${this.objClass})`,
          scope: "sub",
        };
        this.client.search(
          `${this.idAttr}=lmConf-${cfgNum},${this.base}`,
          opt
        )
        .then(res => res.searchEntries)
        .then((res) => {
          // @ts-ignore: cfgNum initialized later
          const conf: LLNG_Conf = {};
          const tmp = res[0][this.contentAttr];
          const data: string[] = ((typeof tmp === "object" ? tmp : [tmp]) as string[] | Buffer[]).map((item) => (item.toString ? item.toString() : item) as string);
          data.forEach((confLine: string) => {
            if (!confLine.match(/^\{(.*?)\}(.*)/)) {
              return reject(`Bad conf line: ${confLine}`);
            }
            const k = RegExp.$1;
            const v = RegExp.$2;
            if (v.match !== null && v.match(/^{/)) {
              conf[k] = JSON.parse(v);
            } else {
              conf[k] = v;
            }
          });
          return resolve(conf);
        }).catch((err) => reject(`LDAP search failed: ${err}`));
      }).catch((err) => reject(`LDAP bind failed: ${err}`));
    });
  }

  // eslint-disable-next-line no-unused-vars
  store(conf: LLNG_Conf) {
    return new Promise<boolean>((resolve, reject) => {
      reject("TODO");
    });
  }
}

export default LDAPConf;
