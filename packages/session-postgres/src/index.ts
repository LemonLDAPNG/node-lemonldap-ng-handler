import DBISession, { SessionDBI_Args } from '@LLNG/session-dbi'
export type SessionPg_Args = SessionDBI_Args

class PgSession extends DBISession {
  constructor (args: SessionPg_Args) {
    super(args)
  }
}

export default PgSession
