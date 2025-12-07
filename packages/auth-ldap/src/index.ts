import type { Request } from "express";
import type { LLNG_Conf, LLNG_Logger } from "@lemonldap-ng/types";
import type { AuthModule, Credentials, AuthResult } from "@lemonldap-ng/portal";
import {
  LDAPConnection,
  extractLDAPConfig,
  type LDAPEntry,
  type LDAPConfig,
} from "@lemonldap-ng/lib-ldap";

/**
 * LDAP authentication module
 *
 * Authenticates users against an LDAP directory.
 * Uses shared connections for better resilience and resource management.
 *
 * Configuration example:
 * ```
 * ldapServer: "ldap://localhost:389",
 * ldapBase: "ou=users,dc=example,dc=com",
 * managerDn: "cn=admin,dc=example,dc=com",
 * managerPassword: "secret",
 * AuthLDAPFilter: "(&(uid=$user)(objectClass=inetOrgPerson))",
 * ```
 */
export class LDAPAuth implements AuthModule {
  readonly name = "LDAP";

  private conf!: LLNG_Conf;
  private ldapConfig!: LDAPConfig;
  private logger!: LLNG_Logger;
  private ldapConnection!: LDAPConnection;
  private useSharedConnection: boolean = true;

  // Store the last authenticated user's entry for UserDB
  private lastEntry: LDAPEntry | null = null;
  private lastUser: string | null = null;

  async init(conf: LLNG_Conf, logger: LLNG_Logger): Promise<void> {
    this.conf = conf;
    this.logger = logger;
    this.ldapConfig = extractLDAPConfig(conf);

    // Use shared connection by default for better resilience
    if (this.useSharedConnection) {
      this.ldapConnection = LDAPConnection.getSharedConnection(
        this.ldapConfig,
        logger,
      );
    } else {
      this.ldapConnection = new LDAPConnection(this.ldapConfig, logger);
    }

    // Connect to LDAP server
    try {
      await this.ldapConnection.connect();
      this.logger.info(
        `LDAP auth initialized, connected to ${this.ldapConnection.getCurrentUrl()}`,
      );
    } catch (e: any) {
      // Don't throw - the connection will retry automatically when needed
      this.logger.warn(
        `LDAP auth: initial connection failed, will retry: ${e.message || e}`,
      );
    }
  }

  extractCredentials(req: Request): Credentials | null {
    const user = req.body?.user || req.body?.username;
    const password = req.body?.password || req.body?.pwd;

    if (!user || !password) {
      return null;
    }

    return { user, password };
  }

  async authenticate(credentials: Credentials): Promise<AuthResult> {
    const { user, password } = credentials;

    // Validate connection (will reconnect if needed)
    if (!(await this.ldapConnection.validateConnection())) {
      this.logger.error("LDAP connection unavailable");
      return {
        success: false,
        error: "LDAP service temporarily unavailable",
        errorCode: "PE_LDAPCONNECTFAILED",
      };
    }

    // Bind as manager to search for user
    if (!(await this.ldapConnection.bind())) {
      this.logger.error("LDAP manager bind failed");
      return {
        success: false,
        error: "LDAP configuration error",
        errorCode: "PE_WRONGMANAGERACCOUNT",
      };
    }

    // Search for user
    let entry: LDAPEntry | null;
    try {
      entry = await this.ldapConnection.searchUser(user);
    } catch (e: any) {
      this.logger.error(`LDAP search failed: ${e.message || e}`);
      return {
        success: false,
        error: "LDAP search error",
        errorCode: "PE_LDAPERROR",
      };
    }

    if (!entry) {
      this.logger.debug(`LDAP auth: user "${user}" not found`);
      return {
        success: false,
        error: "User not found",
        errorCode: "PE_BADCREDENTIALS",
      };
    }

    // Authenticate user with their password
    const bindResult = await this.ldapConnection.userBind(entry.dn, password);

    if (!bindResult.success) {
      this.logger.debug(
        `LDAP auth: authentication failed for user "${user}": ${bindResult.error}`,
      );

      // Handle password policy errors
      if (bindResult.ppolicyError !== undefined) {
        return {
          success: false,
          error: bindResult.error,
          errorCode: bindResult.errorCode,
        };
      }

      return {
        success: false,
        error: "Invalid credentials",
        errorCode: bindResult.errorCode || "PE_BADCREDENTIALS",
      };
    }

    // Store entry for UserDB to use
    this.lastEntry = entry;
    this.lastUser = user;

    this.logger.info(`LDAP auth: user "${user}" authenticated successfully`);

    // Build result with optional PPolicy info
    const result: AuthResult = {
      success: true,
      user,
    };

    // Add PPolicy grace warning if present
    if (bindResult.ppolicyGrace !== undefined) {
      result.info = {
        type: "ppolicyGrace",
        value: bindResult.ppolicyGrace,
        message: `Grace authentications remaining: ${bindResult.ppolicyGrace}`,
      };
      this.logger.info(
        `PPolicy: user "${user}" has ${bindResult.ppolicyGrace} grace authentications remaining`,
      );
    }

    // Add password expiration warning if present
    if (bindResult.ppolicyExpire !== undefined) {
      const expireDays = Math.floor(bindResult.ppolicyExpire / 86400);
      const expireHours = Math.floor((bindResult.ppolicyExpire % 86400) / 3600);

      // Check if we should force password change based on config
      const forceChangeThreshold =
        this.ldapConfig.ldapForcePasswordChangeExpirationWarning;
      if (
        forceChangeThreshold &&
        bindResult.ppolicyExpire < forceChangeThreshold
      ) {
        return {
          success: true,
          user,
          errorCode: "PE_PP_PASSWORD_EXPIRES_SOON",
          info: {
            type: "ppolicyExpire",
            value: bindResult.ppolicyExpire,
            message: `Password expires in ${expireDays} days, ${expireHours} hours`,
          },
        };
      }

      result.info = {
        type: "ppolicyExpire",
        value: bindResult.ppolicyExpire,
        message: `Password expires in ${expireDays} days, ${expireHours} hours`,
      };
      this.logger.info(
        `PPolicy: user "${user}" password expires in ${bindResult.ppolicyExpire} seconds`,
      );
    }

    return result;
  }

  /**
   * Get the last authenticated user's LDAP entry
   * Used by userdb-ldap to avoid duplicate searches
   */
  getLastEntry(): LDAPEntry | null {
    return this.lastEntry;
  }

  /**
   * Get the LDAP connection for reuse by other modules
   */
  getConnection(): LDAPConnection {
    return this.ldapConnection;
  }

  /**
   * Get the LDAP configuration
   */
  getLDAPConfig(): LDAPConfig {
    return this.ldapConfig;
  }

  async close(): Promise<void> {
    // Don't close shared connections here - they're managed globally
    if (!this.useSharedConnection && this.ldapConnection) {
      await this.ldapConnection.close();
    }
    this.lastEntry = null;
    this.lastUser = null;
    if (this.logger) {
      this.logger.debug("LDAP auth closed");
    }
  }
}

/**
 * Factory function to create an LDAP auth module instance
 */
export function createAuthModule(): AuthModule {
  return new LDAPAuth();
}

export default LDAPAuth;
