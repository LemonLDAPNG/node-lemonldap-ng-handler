/**
 * Typescript declarations
 */
export interface PerlDBI_Args {
  dbiChain: string;
  dbiUser?: string | undefined;
  dbiPassword?: string | undefined;
}

const btype = {
  SQLite: "sqlite3",
  Pg: "pg",
  mysql: "mysql",
  Oracle: "oracledb",
};

type DB = "sqlite3" | "pg" | "mysql" | "oracledb";

const convert = {
  database: "database",
  dbname: "database",
  host: "host",
  port: "port",
  encoding: "encoding",
  sid: "sid",
};

import { Knex } from "knex";

import knex from "knex";

export type PerlDBI_Client = Knex;

export default function PerlDBI(args: PerlDBI_Args): PerlDBI_Client {
  if (!args.dbiChain.match(/^dbi:(SQLite|Pg|mysql):(.*)/))
    // istanbul ignore next
    throw new Error(`Invalid dbiChain: ${args.dbiChain}`);

  const type: DB | undefined = btype[RegExp.$1 as keyof typeof btype] as DB;
  if (!type) {
    // istanbul ignore next
    throw new Error(`Unsupported database type: ${RegExp.$1}`);
  }
  const dbArgs: Knex.Config = {};
  dbArgs.client = type;
  dbArgs.connection = {};
  RegExp.$2.split(/;/).map((s: string) => {
    const kv = s.match(/^(.*?)=(.*)$/);
    if (kv) {
      let k: string = convert[kv[1] as keyof typeof convert];
      if (k && k !== "type") {
        if (type === "sqlite3" && k === "database") k = "filename";
        // @ts-ignore
        dbArgs.connection[k] = kv[2];
      } else {
        // istanbul ignore next
        throw new Error(`Unknown DB argument ${k}`);
      }
    }
  });
  if (type === "sqlite3") {
    // @ts-ignore
    if (!dbArgs.connection.filename) {
      // istanbul ignore next
      throw new Error("database should be defined");
    }
    // @ts-ignore
    if (!/^(?:\.|\/)/.test(dbArgs.connection.filename)) {
      // istanbul ignore next
      throw new Error("database must be a path");
    }
    dbArgs.useNullAsDefault = true;
  }
  return knex(dbArgs);
}
