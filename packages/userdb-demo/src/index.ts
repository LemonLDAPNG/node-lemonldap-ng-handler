import type { LLNG_Conf, LLNG_Logger, LLNG_Session } from "@lemonldap-ng/types";
import type { UserDBModule, UserData } from "@lemonldap-ng/portal";

/**
 * Demo UserDB module
 *
 * Uses demoExportedVars from configuration to provide user attributes.
 * Works in conjunction with auth-demo module.
 *
 * Configuration example:
 * ```
 * demoExportedVars: {
 *   dwho: { _password: "dwho", uid: "dwho", cn: "Doctor Who", mail: "dwho@example.com" },
 *   rtyler: { _password: "rtyler", uid: "rtyler", cn: "Rose Tyler", mail: "rtyler@example.com" },
 * }
 * exportedVars: {
 *   uid: "uid",
 *   cn: "cn",
 *   mail: "mail"
 * }
 * ```
 */
export class DemoUserDB implements UserDBModule {
  readonly name = "Demo";

  private conf!: LLNG_Conf;
  private logger!: LLNG_Logger;
  private users: Map<string, Record<string, string>> = new Map();
  private exportedVars: Record<string, string> = {};

  async init(conf: LLNG_Conf, logger: LLNG_Logger): Promise<void> {
    this.conf = conf;
    this.logger = logger;

    // Load demo users from configuration
    const demoExportedVars = conf.demoExportedVars || {};

    for (const [username, userData] of Object.entries(demoExportedVars)) {
      if (typeof userData === "object" && userData !== null) {
        this.users.set(username, userData as Record<string, string>);
      }
    }

    // Add default demo users if none configured
    if (this.users.size === 0) {
      this.logger.info("No demoExportedVars found, using default demo users");
      this.users.set("dwho", {
        uid: "dwho",
        cn: "Doctor Who",
        mail: "dwho@example.com",
      });
      this.users.set("rtyler", {
        uid: "rtyler",
        cn: "Rose Tyler",
        mail: "rtyler@example.com",
      });
    }

    // Load exported vars mapping
    this.exportedVars = (conf.exportedVars as Record<string, string>) || {
      uid: "uid",
      cn: "cn",
      mail: "mail",
    };

    this.logger.info(`Demo UserDB initialized with ${this.users.size} users`);
  }

  async getUser(username: string): Promise<UserData | null> {
    const userData = this.users.get(username);

    if (!userData) {
      this.logger.debug(`Demo UserDB: user "${username}" not found`);
      return null;
    }

    // Build attributes based on exportedVars mapping
    const attributes: Record<string, string | string[]> = {};

    for (const [sessionKey, sourceKey] of Object.entries(this.exportedVars)) {
      const value = userData[sourceKey];
      if (value !== undefined) {
        attributes[sessionKey] = value;
      }
    }

    this.logger.debug(`Demo UserDB: found user "${username}"`);

    return {
      uid: userData.uid || username,
      attributes,
      groups: userData.groups ? userData.groups.split(",") : undefined,
    };
  }

  setSessionInfo(session: LLNG_Session, user: UserData): void {
    // Set uid
    session.uid = user.uid;

    // Copy all attributes to session
    for (const [key, value] of Object.entries(user.attributes)) {
      (session as Record<string, unknown>)[key] = value;
    }

    // Set groups if present
    if (user.groups && user.groups.length > 0) {
      session.groups = user.groups.join("; ");
    }

    this.logger.debug(`Demo UserDB: session info set for "${user.uid}"`);
  }

  async close(): Promise<void> {
    this.users.clear();
    this.logger.debug("Demo UserDB closed");
  }
}

/**
 * Factory function to create a Demo UserDB module instance
 */
export function createUserDBModule(): UserDBModule {
  return new DemoUserDB();
}

export default DemoUserDB;
