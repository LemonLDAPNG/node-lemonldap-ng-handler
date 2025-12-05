import { PerlDBI, PerlDBI_Args, PerlDBI_Client } from "perl-dbi";

export type DBI_Args = PerlDBI_Args & { dbiTable: string | undefined };

export type Schema =
  | {
      cfgNum: number;
      data: string;
    }
  | {
      cfgNum: number;
      field: string;
      value: string;
    };

abstract class DBI {
  db: PerlDBI_Client;
  table: string;

  constructor(args: DBI_Args) {
    this.table = args.dbiTable ? args.dbiTable : "lmConfig";
    delete args.dbiTable;
    this.db = PerlDBI(args);
  }

  available() {
    return new Promise<number[]>((resolve, reject) => {
      this.db
        .select("cfgNum")
        .from(this.table)
        .orderBy("cfgNum")
        .then((results) => {
          const res: any[] = [];
          results.map((entry: Schema) => {
            res.push(entry.cfgNum);
          });
          resolve(res);
        })
        .catch((reason) => {
          reject(`No conf found in database: ${reason}`);
        });
    });
  }

  lastCfg() {
    return new Promise<number>((resolve, reject) => {
      this.db(this.table)
        .max({ cfgNum: "cfgNum" })
        .then((result) => {
          resolve(result[0].cfgNum);
        })
        .catch((reason) => {
          reject(`No conf found in database: ${reason}`);
        });
    });
  }

  destroy() {
    this.db.destroy();
  }
}

export default DBI;
