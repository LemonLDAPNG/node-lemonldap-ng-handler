import fs from "fs";
import { Attribute, Change, Client as LDAPClient, SearchOptions } from "ldapts";
import { LLNG_Session, Session_Accessor } from "@lemonldap-ng/types";
type SessionLDAP_Args = {
  ldapServer: string;
  ldapConfBase: string;
  ldapBindDN: string | undefined;
  ldapBindPassword: string | undefined;
  ldapObjectClass: string | undefined;
  ldapAttributeId: string | undefined;
  ldapAttributeContent: string | undefined;
  ldapCAFile: string | undefined;
};

const defaultValues = {
  ldapObjectClass: "applicationProcess",
  ldapAttributeId: "cn",
  ldapAttributeContent: "description",
};

type CaConf = {
  ca: string[] | undefined;
};

class LDAPSession implements Session_Accessor {
  ldap: LDAPClient;
  base: string;
  class: string;
  contentAttr: string;
  idAttr: string;

  constructor(args: SessionLDAP_Args) {
    ["ldapServer", "ldapConfBase"].forEach((k) => {
      if (!args[<keyof SessionLDAP_Args>k])
        throw new Error(`Missing ${k} argument`);
    });
    const ldapServer = args.ldapServer.match(/^ldap/)
      ? args.ldapServer
      : `ldap://${args.ldapServer}`;
    const ldapCa = args.ldapServer.match(/^ldaps/) ? args.ldapCAFile || "" : "";
    Object.keys(defaultValues).forEach((k) => {
      // @ts-ignore
      if (!args[k]) args[k] = defaultValues[k];
    });
    this.base = args.ldapConfBase;
    // @ts-ignore: args.ldapObjectClass is initialized
    this.class = args.ldapObjectClass;
    // @ts-ignore: args.ldapAttributeContent is initialized
    this.contentAttr = args.ldapAttributeContent;
    // @ts-ignore: args.ldapAttributeId is initialized
    this.idAttr = args.ldapAttributeId;
    const caConf: CaConf = { ca: undefined };
    if (ldapCa != "") {
      caConf.ca = [fs.readFileSync(ldapCa).toString()];
    }
    this.ldap = new LDAPClient({
      tlsOptions: caConf,
      url: ldapServer,
    });
    this.ldap
      .bind(args.ldapBindDN || "", args.ldapBindPassword || "")
      .catch((e) => {
        throw new Error(`LDAP bind error: ${e}`);
      });
  }

  get(id: string) {
    return new Promise<LLNG_Session>((resolve, reject) => {
      const opt: SearchOptions = {
        filter: `(objectClass=${this.class}`,
        scope: "base",
        attributes: [this.contentAttr],
      };
      this.ldap
        .search(`${this.idAttr}=${id},${this.base}`, opt)
        .then((res) => res.searchEntries)
        .then((res) => {
          const tmp = res[0]?.[this.contentAttr] as string | string[];
          const data = <string>res[0]?.[typeof tmp === "object" ? tmp[0] : tmp];
          if (!data) return reject("LDAP session not found");
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(`LDAP session parse error: ${e}`);
          }
        })
        .catch((e) => reject(`LDAP search error: ${e}`));
    });
  }

  async update(data: LLNG_Session) {
    await this.ldap.modify(
      `${this.idAttr}=${data._session_id},${this.base}`,
      new Change({
        operation: "replace",
        modification: new Attribute({
          type: this.contentAttr,
          values: [JSON.stringify(data)],
        }),
      }),
    );
    return true;
  }
}

export default LDAPSession;
