import { MongoClient } from "mongodb";
import { Db, Collection, Document } from "mongodb";
import { LLNG_Conf, Conf_Accessor } from "@lemonldap-ng/types";

const ref = [
  "host",
  "auth_mechanism",
  "auth_mechanism_properties",
  "bson_codec",
  "connect_timeout_ms",
  "db_name",
  "heartbeat_frequency_ms",
  "j",
  "local_threshold_ms",
  "max_time_ms",
  "password",
  "port",
  "read_pref_mode",
  "read_pref_tag_sets",
  "replica_set_name",
  "server_selection_timeout_ms",
  "server_selection_try_once",
  "socket_check_interval_ms",
  "socket_timeout_ms",
  "ssl",
  "username",
  "w",
  "wtimeout",
  "read_concern_level",
];

export type Mongo_Args = {
  dbName: string;
  collectionName: string | undefined;
  host: string | undefined;
  port: number | string | undefined;
  [key: (typeof ref)[number]]: string | number | undefined;
};

class MongoConf implements Conf_Accessor {
  colName: string;
  db: Db | undefined;
  col: Collection<LLNG_Conf> | undefined;

  constructor(args: Mongo_Args) {
    const dbName: string = args.dbName || "llConfDB";
    const host = args.host || "localhost";
    const port = args.port
      ? typeof args.port === "string"
        ? parseInt(args.port)
        : args.port
      : 27017;
    this.colName = args.collectionName || "configuration";
    let url = `mongodb://${host}:${port}/?`;
    ref.forEach((name) => {
      const tmp = name.split("_");
      let nam2 = tmp.shift();
      tmp.forEach((s: string) => {
        nam2 += s[0].toUpperCase() + s.slice(1);
      });
      const opt = args[name] != null ? args[name] : nam2 ? args[nam2] : null;
      if (opt !== null) url += `${nam2}=${opt}&`;
    });
    url = url.replace(/&$/, "");
    const mongo = new MongoClient(url);
    mongo
      .connect()
      .then(() => {
        this.db = mongo.db(dbName);
        if (this.db === undefined)
          throw new Error("Unable to connect to Mongo");
        this.col = this.db.collection<LLNG_Conf>(this.colName);
      })
      .catch((err) => {
        throw new Error(err);
      });
  }

  available() {
    return new Promise<number[]>((resolve, reject) => {
      if (!this.col) return reject("MongoDB not initialized please wait");
      const res: number[] = [];
      this.col
        .find(
          {},
          {
            sort: { _id: 1 },
            projection: { _id: true },
          },
        )
        .forEach((cfg: Document) => {
          res.push(typeof cfg._id === "string" ? parseInt(cfg._id) : cfg._id);
        })
        .then(() => resolve(res))
        .catch((e) => reject(e));
    });
  }

  lastCfg() {
    return new Promise<number>((resolve, reject) => {
      this.available()
        // @ts-ignore: available is always populated
        .then((res) => resolve(res.pop()))
        .catch((err) => reject(err));
    });
  }

  load(cfgNum: number, _fields: string[] = []) {
    return new Promise<LLNG_Conf>((resolve, reject) => {
      if (!this.col) return reject("MongoDB not initialized please wait");
      this.col
        .findOne({ _id: cfgNum.toString() })
        .then((res) => {
          if (res !== null) {
            Object.keys(res).forEach((k) => {
              const v = res[k];
              if (typeof v === "string" && v.match(/^{/)) {
                res[k] = JSON.parse(v);
              }
            });
            resolve(res as LLNG_Conf);
          } else {
            reject("No configuration found");
          }
        })
        .catch((e) => reject(e));
    });
  }

  store(_conf: LLNG_Conf) {
    return new Promise<boolean>((resolve, reject) => {
      reject("Not yet implemented");
    });
  }
}

export default MongoConf;
