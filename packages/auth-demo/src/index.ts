import type { Request } from "express";
import type { LLNG_Conf, LLNG_Logger } from "@lemonldap-ng/types";
import type { AuthModule, Credentials, AuthResult } from "@lemonldap-ng/portal";

/**
 * Demo authentication module
 *
 * Uses demoExportedVars from configuration for authentication.
 * Each key in demoExportedVars is a username, and the value contains
 * the user's password and attributes.
 *
 * Configuration example:
 * ```
 * demoExportedVars: {
 *   dwho: { _password: "dwho", uid: "dwho", cn: "Doctor Who", mail: "dwho@example.com" },
 *   rtyler: { _password: "rtyler", uid: "rtyler", cn: "Rose Tyler", mail: "rtyler@example.com" },
 * }
 * ```
 */
export class DemoAuth implements AuthModule {
  readonly name = "Demo";

  private conf!: LLNG_Conf;
  private logger!: LLNG_Logger;
  private users: Map<string, Record<string, string>> = new Map();

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
        _password: "dwho",
        uid: "dwho",
        cn: "Doctor Who",
        mail: "dwho@example.com",
      });
      this.users.set("rtyler", {
        _password: "rtyler",
        uid: "rtyler",
        cn: "Rose Tyler",
        mail: "rtyler@example.com",
      });
    }

    this.logger.info(`Demo auth initialized with ${this.users.size} users`);
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

    const userData = this.users.get(user);

    if (!userData) {
      this.logger.debug(`Demo auth: user "${user}" not found`);
      return {
        success: false,
        error: "User not found",
        errorCode: "PE_BADCREDENTIALS",
      };
    }

    const storedPassword = userData._password || userData.userPassword;

    if (password !== storedPassword) {
      this.logger.debug(`Demo auth: invalid password for user "${user}"`);
      return {
        success: false,
        error: "Invalid password",
        errorCode: "PE_BADCREDENTIALS",
      };
    }

    this.logger.info(`Demo auth: user "${user}" authenticated successfully`);
    return {
      success: true,
      user,
    };
  }

  async close(): Promise<void> {
    this.users.clear();
    this.logger.debug("Demo auth closed");
  }
}

/**
 * Factory function to create a Demo auth module instance
 */
export function createAuthModule(): AuthModule {
  return new DemoAuth();
}

export default DemoAuth;
