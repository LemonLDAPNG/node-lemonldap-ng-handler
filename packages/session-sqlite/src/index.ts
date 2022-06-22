import DBISession, { SessionDBI_Args } from '@lemonldap-ng/session-dbi'
export type SessionSQLite_Args = SessionDBI_Args

class SQLiteSession extends DBISession {
  constructor (args: SessionSQLite_Args) {
    super(args)
  }
}

export default SQLiteSession
