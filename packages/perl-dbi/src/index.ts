/**
 * Typescript declarations
 */
export interface PerlDBI_Args {
  dbiChain: string;
  dbiUser?: string | undefined;
  dbiPassword?: string | undefined;
}

/**
 * Parsed DBI connection options
 */
export interface DBI_ConnectionOptions {
  type: "sqlite3" | "pg" | "mysql" | "oracledb";
  database?: string;
  host?: string;
  port?: string;
  encoding?: string;
  sid?: string;
  user?: string;
  password?: string;
}

/**
 * Regex pattern to parse DBI chain format: dbi:Type:params
 */
const DBI_CHAIN_PATTERN = /^dbi:(SQLite|Pg|mysql|Oracle):(.*)/i;

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

/**
 * Parse a DBI chain string and return connection options
 * Format: dbi:Type:param1=value1;param2=value2
 * Example: dbi:Pg:dbname=llng;host=localhost;port=5432
 */
export function parseDbiChain(args: PerlDBI_Args): DBI_ConnectionOptions {
  if (!args.dbiChain.match(DBI_CHAIN_PATTERN))
    throw new Error(`Invalid dbiChain: ${args.dbiChain}`);

  const type: DB | undefined = btype[RegExp.$1 as keyof typeof btype] as DB;
  if (!type) {
    throw new Error(`Unsupported database type: ${RegExp.$1}`);
  }

  const options: DBI_ConnectionOptions = { type };

  RegExp.$2.split(/;/).forEach((s: string) => {
    const eqIndex = s.indexOf("=");
    if (eqIndex > 0) {
      const key = s.substring(0, eqIndex);
      const value = s.substring(eqIndex + 1);
      const k: string = convert[key as keyof typeof convert];
      if (k && k !== "type") {
        (options as any)[k] = value;
      }
    }
  });

  if (args.dbiUser) {
    options.user = args.dbiUser;
  }
  if (args.dbiPassword) {
    options.password = args.dbiPassword;
  }

  return options;
}

function PerlDBI(args: PerlDBI_Args): PerlDBI_Client {
  if (!args.dbiChain.match(DBI_CHAIN_PATTERN))
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
    const eqIndex = s.indexOf("=");
    if (eqIndex > 0) {
      const key = s.substring(0, eqIndex);
      const value = s.substring(eqIndex + 1);
      let k: string = convert[key as keyof typeof convert];
      if (k && k !== "type") {
        if (type === "sqlite3" && k === "database") k = "filename";
        // @ts-ignore
        dbArgs.connection[k] = value;
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
  // Add user and password to connection config
  if (args.dbiUser) {
    // @ts-ignore
    dbArgs.connection.user = args.dbiUser;
  }
  if (args.dbiPassword) {
    // @ts-ignore
    dbArgs.connection.password = args.dbiPassword;
  }
  return knex(dbArgs);
}

// Export for ESM
export default PerlDBI;

// Also export the function directly for CommonJS compatibility
// This allows both `import PerlDBI from "perl-dbi"` and `const PerlDBI = require("perl-dbi")`
export { PerlDBI };
