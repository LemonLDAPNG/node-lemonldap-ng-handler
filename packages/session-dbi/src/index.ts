import { PerlDBI, PerlDBI_Client, PerlDBI_Args } from "perl-dbi";
import {
  Apache_Session,
  LLNG_Session,
  Session_Accessor,
} from "@lemonldap-ng/types";
export type SessionDBI_Args = {
  DataSource: string;
  UserName: string | undefined;
  Password: string | undefined;
  TableName: string | undefined;
  Commit: number | undefined;
  // For Apache::Session::Browseable::*
  Index: string | undefined;
};

abstract class DBISession implements Session_Accessor {
  db: PerlDBI_Client;
  table: string;

  constructor(config: SessionDBI_Args) {
    this.db = PerlDBI(<PerlDBI_Args>{
      dbiChain: config.DataSource,
      dbiUser: config.UserName,
      dbiPassword: config.Password,
    });
    this.table = config.TableName || "sessions";
  }

  get(id: string) {
    return new Promise<LLNG_Session>((resolve, reject) => {
      this.db
        .select("a_session")
        .from(this.table)
        .where("id", "=", id)
        .then((results: Apache_Session[]) => {
          if (results.length === 0) {
            reject("Session doesn't exist");
          } else {
            const session = results[0].a_session;
            // Handle both JSONB (already parsed) and TEXT (needs parsing)
            resolve(
              (typeof session === "string"
                ? JSON.parse(session)
                : session) as LLNG_Session,
            );
          }
        });
    });
  }

  update(data: LLNG_Session) {
    return new Promise<boolean>((resolve, reject) => {
      this.db(this.table)
        .where("id", "=", data._session_id)
        .update({ a_session: JSON.stringify(data) })
        .then(() => resolve(true))
        // istanbul ignore next
        .catch((e) => reject(e));
    });
  }
}

export default DBISession;
