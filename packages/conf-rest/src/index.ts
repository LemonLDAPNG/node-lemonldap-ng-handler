import fetch from "node-fetch";
import { LLNG_Conf, Conf_Accessor } from "@lemonldap-ng/types";

export type REST_Args = {
  baseUrl: string;
  user?: string;
  password?: string;
};

class RESTConf implements Conf_Accessor {
  baseUrl: string;
  user: string | undefined;
  password: string | undefined;

  constructor(args: REST_Args) {
    if (!args.baseUrl)
      throw new Error("baseUrl parameter is required in REST configuration");

    if (!args.baseUrl.match(/(https?):\/\/([^/:]+)(?::(\d+))?(.*)/))
      throw new Error(`Bad URL ${args.baseUrl}`);

    this.baseUrl = args.baseUrl.split('/',1)[0];
    if (args.user) {
      this.user = args.user;
      if (!args.password) throw new Error("password required");
      this.password = args.password;
    }
  }

  available() {
    return new Promise<number[]>((resolve, reject) => {
      reject("Not implemented for now");
    });
  }

  lastCfg() {
    return new Promise<number>((resolve, reject) => {
      this.get("latest")
        .then((res: LLNG_Conf) => {
          if (res.cfgNum) {
            resolve(res.cfgNum);
          } else {
            reject("No configuration available");
          }
        })
        .catch((e) => reject(e));
    });
  }

  load(cfgNum: number) {
    return new Promise<LLNG_Conf>((resolve, reject) => {
      this.get(`${cfgNum}?full=1`)
        .then((res) => resolve(res))
        .catch((e) => reject(e));
    });
  }

  // eslint-disable-next-line no-unused-vars
  store(fields: LLNG_Conf) {
    return new Promise<boolean>((resolve, reject) => {
      reject("Not implemented for now");
    });
  }

  get(query: string) {
    return new Promise<LLNG_Conf>((resolve, reject) => {
      const headers: { Accept: string; Authorization?: string } = {
        Accept: "application/json",
      };
      if (this.user) {
        headers.Authorization =
          "Basic " +
          Buffer.from(`${this.user}:${this.password}`).toString("base64");
      }
      fetch(`${this.baseUrl}/${query}`, {
        method: "get",
        headers,
      })
        .then((response) => {
          if (response.status !== 200) {
            reject(response.status);
          } else {
            return response.json() as Promise<LLNG_Conf>;
          }
        })
        .then((value) => {
          if (typeof value !== "object") return reject("Bad JSON response");
          resolve(value as LLNG_Conf);
        })
        .catch((err) => reject(err));
    });
  }
}

export default RESTConf;
