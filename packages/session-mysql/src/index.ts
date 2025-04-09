import DBISession, { SessionDBI_Args } from "@lemonldap-ng/session-dbi";
export type SessionMySQL_Args = SessionDBI_Args & {
  LockDataSource: string | undefined;
  LockUserName: string | undefined;
  LockPassword: string | undefined;
};

class MySQLSession extends DBISession {
  constructor(args: SessionMySQL_Args) {
    super(args);
  }
}

export default MySQLSession;
