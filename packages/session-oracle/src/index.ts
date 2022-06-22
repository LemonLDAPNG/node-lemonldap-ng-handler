import DBISession, { SessionDBI_Args } from '@lemonldap-ng/session-dbi'
export type SessionOracle_Args = SessionDBI_Args

class OracleSession extends DBISession {
  constructor (args: SessionOracle_Args) {
    super(args)
  }
}

export default OracleSession
