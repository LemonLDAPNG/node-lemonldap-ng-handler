/**
 * CAS UserDB module for LemonLDAP::NG
 * Maps CAS attributes to session data
 * @module @lemonldap-ng/userdb-cas
 */

// Session data interface
export interface SessionData {
  _user?: string;
  _casAttributes?: Record<string, string[]>;
  [key: string]: unknown;
}

// User info from CAS
export interface CASUserInfo {
  userId: string;
  attributes: Record<string, string[]>;
}

// Configuration for CAS UserDB
export interface CASUserDBConfig {
  // Mapping of session keys to CAS attribute names
  exportedVars?: Record<string, string>;

  // Logger
  logger?: {
    debug: (msg: string, ...args: unknown[]) => void;
    info: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
  };
}

/**
 * CAS UserDB class
 * Retrieves user information from CAS attributes stored during authentication
 */
export class CASUserDB {
  readonly name = "CAS";
  private config: CASUserDBConfig;

  constructor(config: CASUserDBConfig = {}) {
    this.config = config;
  }

  async init(): Promise<void> {
    this.log("debug", "CAS UserDB initialized");
  }

  /**
   * Get user info from session
   * The CAS attributes should already be stored in the session during authentication
   */
  async getUser(
    userId: string,
    session: SessionData,
  ): Promise<CASUserInfo | null> {
    // The attributes should already be available from authentication
    const attributes = session._casAttributes || {};

    this.log("debug", `Getting user info for ${userId}`);

    return {
      userId,
      attributes,
    };
  }

  /**
   * Set session info from CAS user data
   * Maps CAS attributes to session keys based on configuration
   */
  async setSessionInfo(
    session: SessionData,
    userInfo: CASUserInfo,
  ): Promise<void> {
    const { userId, attributes } = userInfo;

    // Set user
    session._user = userId;

    // Store raw CAS attributes
    session._casAttributes = attributes;

    // Map attributes according to exportedVars
    if (this.config.exportedVars) {
      for (const [sessionKey, casAttrName] of Object.entries(
        this.config.exportedVars,
      )) {
        const values = attributes[casAttrName];
        if (values && values.length > 0) {
          // Use first value for single value, array for multiple
          session[sessionKey] = values.length === 1 ? values[0] : values;
        }
      }
    }

    this.log("info", `Session info set for user ${userId}`);
  }

  /**
   * Close the UserDB (no-op for CAS)
   */
  async close(): Promise<void> {
    this.log("debug", "CAS UserDB closed");
  }

  /**
   * Logger helper
   */
  private log(
    level: "debug" | "info" | "warn" | "error",
    msg: string,
    ...args: unknown[]
  ): void {
    if (this.config.logger) {
      this.config.logger[level](msg, ...args);
    }
  }
}
