
/**
 * Typescript declarations
 */
interface PerlDBI_Args {
  dbiChain:    string;
  dbiUser:     string | undefined;
  dbiPassword: string | undefined;
};

const btype = {
  SQLite: "sqlite",
  Pg: "potgres",
  mysql: "mysql"
};

type DB = "sqlite" | "postgres" | "mysql";

interface DB_Args {
  dbname?: string;
  user?: string;
  password?: string;
  host?: string;
  post?: string;
  encoding?: string;
}

const convert = {
  database: 'dbname',
  dbname: 'dbname',
  host: 'host',
  port: 'port',
  encoding: 'encoding'
};

const Dbjs = require('database-js').Connection;

class PerlDBI extends Dbjs {
  constructor(args: PerlDBI_Args) {
    const dbArgs: DB_Args = {};

    if (!args.dbiChain.match(/^dbi:(SQLite|Pg|mysql):(.*)/)) {
      throw new Error(`Invalid dbiChain: ${args.dbiChain}`);
    }
    const type: DB | undefined = btype[RegExp.$1 as keyof typeof btype] as DB;
    if (!type) {
    	throw new Error(`Unsupported database type: ${RegExp.$1}`);
    }
    RegExp.$2.split(/;/).map( (s: string) => {
      let kv = s.match(/^(.*?)=(.*)$/);
      if (kv) {
        let k: string = convert[kv[1] as keyof typeof convert];
	if (k && k !== 'type') {
	  // @ts-ignore
          dbArgs[k] = kv[2];
	}
	else {
	  throw new Error(`Unknown DB argument ${k}`);
	}
      }
    });
    let chain: string = type + '://';
    if (type === 'sqlite') {
      if ( !dbArgs.dbname ) {
        throw new Error('dbname should be defined');
      }
      if ( !/^(?:\.|\/)/.test(dbArgs.dbname) ) {
        throw new Error("dbname must be a path");
      }
      chain += dbArgs.dbname;
    } else {
      chain += dbArgs.user + ':' + dbArgs.password +'@'
        + (dbArgs.host ? dbArgs.host : 'localhost')
	+ '/' + dbArgs.dbname;
    }
    console.debug(`Chain ${chain}`);
    super(chain);
  }
}

export default PerlDBI;
