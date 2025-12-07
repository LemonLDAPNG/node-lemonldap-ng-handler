import type { LLNG_Conf, LLNG_Logger, LLNG_Session } from "@lemonldap-ng/types";
import type { UserDBModule, UserData } from "@lemonldap-ng/portal";
import {
  LDAPConnection,
  extractLDAPConfig,
  type LDAPEntry,
  type LDAPConfig,
} from "@lemonldap-ng/lib-ldap";

/**
 * LDAP UserDB module
 *
 * Retrieves user attributes and group membership from LDAP.
 * Can share connection with auth-ldap for better performance.
 *
 * Configuration example:
 * ```
 * ldapServer: "ldap://localhost:389",
 * ldapBase: "ou=users,dc=example,dc=com",
 * ldapExportedVars: {
 *   name: "cn",
 *   mail: "mail",
 *   surname: "sn"
 * },
 * ldapGroupBase: "ou=groups,dc=example,dc=com",
 * ldapGroupAttributeName: "member",
 * ldapGroupAttributeNameUser: "dn"
 * ```
 */
export class LDAPUserDB implements UserDBModule {
  readonly name = "LDAP";

  private conf!: LLNG_Conf;
  private ldapConfig!: LDAPConfig;
  private logger!: LLNG_Logger;
  private ldapConnection!: LDAPConnection;
  private useSharedConnection: boolean = true;

  // Mapping: session key => LDAP attribute
  private exportedVars: Record<string, string> = {};

  async init(conf: LLNG_Conf, logger: LLNG_Logger): Promise<void> {
    this.conf = conf;
    this.logger = logger;
    this.ldapConfig = extractLDAPConfig(conf);

    // Use shared connection (same as auth-ldap)
    if (this.useSharedConnection) {
      this.ldapConnection = LDAPConnection.getSharedConnection(
        this.ldapConfig,
        logger,
      );
    } else {
      this.ldapConnection = new LDAPConnection(this.ldapConfig, logger);
    }

    // Build exported vars mapping
    // ldapExportedVars takes precedence
    this.exportedVars = {
      ...(conf.exportedVars as Record<string, string>),
      ...(this.ldapConfig.ldapExportedVars || {}),
    };

    // Add default mappings if not specified
    if (!this.exportedVars.uid) {
      this.exportedVars.uid = "uid";
    }
    if (!this.exportedVars.cn) {
      this.exportedVars.cn = "cn";
    }
    if (!this.exportedVars.mail) {
      this.exportedVars.mail = "mail";
    }

    // Try to connect if not already connected
    if (!this.ldapConnection.isConnected()) {
      try {
        await this.ldapConnection.connect();
      } catch (e: any) {
        // Don't throw - connection will retry when needed
        this.logger.warn(
          `LDAP UserDB: initial connection failed, will retry: ${e.message || e}`,
        );
      }
    }

    this.logger.info(
      `LDAP UserDB initialized with ${Object.keys(this.exportedVars).length} exported vars`,
    );
  }

  async getUser(username: string): Promise<UserData | null> {
    // Validate connection
    if (!(await this.ldapConnection.validateConnection())) {
      this.logger.error("LDAP UserDB: connection unavailable");
      return null;
    }

    // Bind as manager
    if (!(await this.ldapConnection.bind())) {
      this.logger.error("LDAP UserDB: manager bind failed");
      return null;
    }

    // Search for user
    let entry: LDAPEntry | null;
    try {
      entry = await this.ldapConnection.searchUser(username);
    } catch (e: any) {
      this.logger.error(`LDAP UserDB: search failed: ${e.message || e}`);
      return null;
    }

    if (!entry) {
      this.logger.debug(`LDAP UserDB: user "${username}" not found`);
      return null;
    }

    return this.buildUserData(entry, username);
  }

  /**
   * Build UserData from LDAP entry
   */
  private async buildUserData(
    entry: LDAPEntry,
    username: string,
  ): Promise<UserData> {
    // Map LDAP attributes to session keys
    const attributes: Record<string, string | string[]> = {};

    for (const [sessionKey, ldapAttr] of Object.entries(this.exportedVars)) {
      const value = this.ldapConnection.getLdapValue(entry, ldapAttr);
      if (value) {
        attributes[sessionKey] = value;
      }
    }

    // Store DN for reference
    attributes._dn = entry.dn;

    // Get groups if configured
    let groups: string[] | undefined;
    if (this.ldapConfig.ldapGroupBase) {
      groups = await this.loadGroups(entry);
    }

    const uid =
      (attributes.uid as string) ||
      this.ldapConnection.getLdapValue(entry, "uid") ||
      username;

    this.logger.debug(
      `LDAP UserDB: loaded ${Object.keys(attributes).length} attributes for "${username}"`,
    );

    return {
      uid,
      attributes,
      groups,
    };
  }

  /**
   * Load group membership from LDAP
   */
  private async loadGroups(entry: LDAPEntry): Promise<string[]> {
    const userAttr = this.ldapConfig.ldapGroupAttributeNameUser || "dn";

    // Get the value to search in groups
    let userValue: string;
    if (userAttr.toLowerCase() === "dn") {
      userValue = entry.dn;
    } else {
      userValue = this.ldapConnection.getLdapValue(entry, userAttr);
    }

    if (!userValue) {
      return [];
    }

    // Decode if configured
    if (this.ldapConfig.ldapGroupDecodeSearchedValue) {
      try {
        userValue = decodeURIComponent(userValue);
      } catch {
        // Keep original value if decoding fails
      }
    }

    try {
      const groups = await this.ldapConnection.searchGroups(userValue);
      return Object.keys(groups);
    } catch (e: any) {
      this.logger.error(`LDAP UserDB: group search failed: ${e.message || e}`);
      return [];
    }
  }

  setSessionInfo(session: LLNG_Session, user: UserData): void {
    // Set uid
    session.uid = user.uid;

    // Copy all attributes to session
    for (const [key, value] of Object.entries(user.attributes)) {
      // Skip internal attributes that shouldn't override session properties
      if (key === "_session_id" || key === "_utime") {
        continue;
      }
      (session as Record<string, unknown>)[key] = value;
    }

    // Set groups
    if (user.groups && user.groups.length > 0) {
      const separator = this.ldapConfig.multiValuesSeparator || ";";
      session.groups = user.groups.join(separator);

      // Also build hGroups for compatibility
      const hGroups: Record<string, { name: string }> = {};
      for (const group of user.groups) {
        hGroups[group] = { name: group };
      }
      (session as Record<string, unknown>).hGroups = hGroups;
    }

    this.logger.debug(`LDAP UserDB: session info set for "${user.uid}"`);
  }

  async close(): Promise<void> {
    // Don't close shared connections
    if (!this.useSharedConnection && this.ldapConnection) {
      await this.ldapConnection.close();
    }
    if (this.logger) {
      this.logger.debug("LDAP UserDB closed");
    }
  }
}

/**
 * Factory function to create an LDAP UserDB module instance
 */
export function createUserDBModule(): UserDBModule {
  return new LDAPUserDB();
}

export default LDAPUserDB;
