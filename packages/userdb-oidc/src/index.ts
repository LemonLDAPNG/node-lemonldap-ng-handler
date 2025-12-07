/**
 * OIDC UserDB module for LemonLDAP::NG
 *
 * Retrieves user attributes from OIDC claims (ID token and UserInfo).
 * Compatible with Perl LemonLDAP::NG oidcOPMetaDataExportedVars configuration.
 */

import type { LLNG_Conf, LLNG_Logger, LLNG_Session } from "@lemonldap-ng/types";

/**
 * User data from UserDB
 */
export interface UserData {
  uid: string;
  attributes: Record<string, string | string[]>;
  groups?: string[];
}

/**
 * UserDB module interface
 */
export interface UserDBModule {
  readonly name: string;
  init(_conf: LLNG_Conf, _logger: LLNG_Logger): Promise<void>;
  getUser(_username: string): Promise<UserData | null>;
  setSessionInfo(_session: LLNG_Session, _user: UserData): void;
  close?(): Promise<void>;
}

/**
 * OIDC claims data passed from auth module
 */
export interface OIDCClaims {
  /** ID token claims */
  idTokenClaims?: Record<string, unknown>;
  /** UserInfo claims */
  userInfo?: Record<string, unknown>;
  /** OP confKey used for authentication */
  opConfKey?: string;
}

/**
 * OIDC UserDB configuration
 */
export interface OIDCUserDBConfig {
  /** Exported variables mapping per OP (oidcOPMetaDataExportedVars) */
  oidcOPMetaDataExportedVars?: Record<string, Record<string, string>>;
  /** Global exported variables */
  exportedVars?: Record<string, string>;
  /** Multi-value separator (default: ";") */
  multiValuesSeparator?: string;
}

/**
 * Extract OIDC UserDB configuration from LLNG_Conf
 */
export function extractOIDCUserDBConfig(conf: LLNG_Conf): OIDCUserDBConfig {
  // Build OP exported vars from oidcOPMetaData
  const oidcOPMetaData = conf.oidcOPMetaData as
    | Record<string, { oidcOPMetaDataExportedVars?: Record<string, string> }>
    | undefined;

  const oidcOPMetaDataExportedVars: Record<string, Record<string, string>> = {};

  if (oidcOPMetaData) {
    for (const [opKey, opConfig] of Object.entries(oidcOPMetaData)) {
      if (opConfig.oidcOPMetaDataExportedVars) {
        oidcOPMetaDataExportedVars[opKey] = opConfig.oidcOPMetaDataExportedVars;
      }
    }
  }

  return {
    oidcOPMetaDataExportedVars,
    exportedVars: conf.exportedVars as Record<string, string> | undefined,
    multiValuesSeparator: (conf.multiValuesSeparator || ";") as string,
  };
}

/**
 * OIDC UserDB module
 *
 * This module retrieves user attributes from OIDC claims that were
 * obtained during authentication. It uses the oidcOPMetaDataExportedVars
 * configuration to map claims to session attributes.
 */
export class OIDCUserDB implements UserDBModule {
  readonly name: string = "OpenIDConnect";

  private config!: OIDCUserDBConfig;
  private logger!: LLNG_Logger;

  /**
   * Current OIDC claims (set by auth module via setOIDCClaims)
   */
  private currentClaims: OIDCClaims | null = null;

  /**
   * Initialize the OIDC UserDB module
   */
  async init(conf: LLNG_Conf, logger: LLNG_Logger): Promise<void> {
    this.config = extractOIDCUserDBConfig(conf);
    this.logger = logger;

    logger.info(
      `OIDC UserDB initialized with ${Object.keys(this.config.oidcOPMetaDataExportedVars || {}).length} OPs configured`,
    );
  }

  /**
   * Set OIDC claims from authentication result
   * This should be called by the auth module after successful authentication
   */
  setOIDCClaims(claims: OIDCClaims): void {
    this.currentClaims = claims;
  }

  /**
   * Get user data from OIDC claims
   *
   * Note: For OIDC, the username parameter is typically the 'sub' claim.
   * The actual user data comes from the claims set via setOIDCClaims().
   */
  async getUser(username: string): Promise<UserData | null> {
    if (!this.currentClaims) {
      this.logger.warn("OIDC UserDB: No claims available");
      return null;
    }

    const claims = this.mergeClaims(
      this.currentClaims.idTokenClaims || {},
      this.currentClaims.userInfo || {},
    );

    // Get the exported vars for this OP
    const opKey = this.currentClaims.opConfKey;
    let exportedVars: Record<string, string> = {};

    if (opKey && this.config.oidcOPMetaDataExportedVars?.[opKey]) {
      exportedVars = {
        ...this.config.exportedVars,
        ...this.config.oidcOPMetaDataExportedVars[opKey],
      };
    } else {
      exportedVars = this.config.exportedVars || {};
    }

    // Default mappings if not specified
    if (Object.keys(exportedVars).length === 0) {
      exportedVars = {
        uid: "sub",
        mail: "email",
        cn: "name",
      };
    }

    const userData = this.buildUserData(claims, exportedVars, username);

    this.logger.debug(
      `OIDC UserDB: loaded ${Object.keys(userData.attributes).length} attributes for "${username}"`,
    );

    return userData;
  }

  /**
   * Merge ID token claims and userinfo claims
   * UserInfo takes precedence
   */
  private mergeClaims(
    idTokenClaims: Record<string, unknown>,
    userInfo: Record<string, unknown>,
  ): Record<string, unknown> {
    return { ...idTokenClaims, ...userInfo };
  }

  /**
   * Build UserData from claims
   */
  private buildUserData(
    claims: Record<string, unknown>,
    exportedVars: Record<string, string>,
    username: string,
  ): UserData {
    const attributes: Record<string, string | string[]> = {};
    const separator = this.config.multiValuesSeparator || ";";

    // Map claims to session keys using exportedVars
    for (const [sessionKey, claimName] of Object.entries(exportedVars)) {
      const value = claims[claimName];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Handle array values
          attributes[sessionKey] = value.map(String);
        } else if (typeof value === "string" && value.includes(separator)) {
          // Handle multi-value strings
          attributes[sessionKey] = value.split(separator);
        } else {
          attributes[sessionKey] = String(value);
        }
      }
    }

    // Also include all claims as _oidc_* for reference
    for (const [key, value] of Object.entries(claims)) {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          attributes[`_oidc_${key}`] = value.map(String);
        } else {
          attributes[`_oidc_${key}`] = String(value);
        }
      }
    }

    // Determine uid
    const uid =
      (attributes.uid as string) || (claims.sub as string) || username;

    return {
      uid,
      attributes,
    };
  }

  /**
   * Set session info from user data
   */
  setSessionInfo(session: LLNG_Session, user: UserData): void {
    // Set uid
    session.uid = user.uid;

    // Set _user if not already set
    if (!session._user) {
      session._user = user.uid;
    }

    // Copy all attributes to session
    for (const [key, value] of Object.entries(user.attributes)) {
      // Skip internal OIDC attributes for session storage (but keep mapped ones)
      if (key.startsWith("_oidc_")) {
        continue;
      }

      // Skip session properties that shouldn't be overwritten
      if (key === "_session_id" || key === "_utime") {
        continue;
      }

      (session as Record<string, unknown>)[key] = value;
    }

    // Store OIDC-specific session info
    if (this.currentClaims) {
      if (this.currentClaims.opConfKey) {
        (session as Record<string, unknown>)._oidcOP =
          this.currentClaims.opConfKey;
      }

      const sub =
        this.currentClaims.userInfo?.sub ||
        this.currentClaims.idTokenClaims?.sub;
      if (sub) {
        (session as Record<string, unknown>)._oidcSub = String(sub);
      }
    }

    this.logger.debug(`OIDC UserDB: session info set for "${user.uid}"`);
  }

  /**
   * Close the module (no-op for OIDC)
   */
  async close(): Promise<void> {
    // No cleanup needed
  }
}

/**
 * Factory function to create OIDC UserDB module
 */
export function createOIDCUserDB(): OIDCUserDB {
  return new OIDCUserDB();
}

/**
 * Factory function matching portal's expected signature
 */
export function createUserDBModule(): UserDBModule {
  return new OIDCUserDB();
}

export default OIDCUserDB;
