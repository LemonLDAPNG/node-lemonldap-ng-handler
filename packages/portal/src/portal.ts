import Conf from "@lemonldap-ng/conf";
import Session from "@lemonldap-ng/session";
import Logger from "@lemonldap-ng/logger";
import crypto from "crypto";
import type { LLNG_Conf, LLNG_Session, LLNG_Logger } from "@lemonldap-ng/types";
import type {
  PortalOptions,
  AuthModule,
  UserDBModule,
  PasswordModule,
} from "./types";
import { TemplateEngine } from "./templates/engine";

/**
 * Main Portal class
 * Handles initialization and provides access to auth/userdb modules
 */
export class Portal {
  private confAcc: Conf;
  private conf: LLNG_Conf | null = null;
  private sessionAcc: Session | null = null;
  private logger: LLNG_Logger | null = null;
  private authModule: AuthModule | null = null;
  private userDBModule: UserDBModule | null = null;
  private passwordModule: PasswordModule | null = null;
  private templateEngine: TemplateEngine | null = null;
  private options: PortalOptions;

  public ready: Promise<boolean>;

  constructor(options: PortalOptions = {}) {
    this.options = options;
    this.confAcc = new Conf(options.configStorage || {});
    this.ready = this.initialize();
  }

  private async initialize(): Promise<boolean> {
    await this.confAcc.ready;
    this.conf = await this.confAcc.getConf({});

    // Initialize logger
    const logger = await Logger(this.conf, false);
    this.logger = logger;
    logger.info("Portal initializing...");

    // Initialize session storage
    if (!this.conf.globalStorage || !this.conf.globalStorageOptions) {
      throw new Error("Missing session storage configuration");
    }
    this.sessionAcc = new Session({
      storageModule: this.conf.globalStorage,
      storageModuleOptions: this.conf.globalStorageOptions,
    });
    await this.sessionAcc.ready;

    // Initialize template engine
    this.templateEngine = new TemplateEngine(this.options.viewsPath);

    // Load auth module
    const authType = (this.conf.authentication || "Demo").toLowerCase();
    await this.loadAuthModule(authType);

    // Load userDB module
    const userDBType = (this.conf.userDB || "Demo").toLowerCase();
    await this.loadUserDBModule(userDBType);

    // Load password module (if configured)
    const passwordDBType = this.conf.passwordDB as string | undefined;
    if (passwordDBType) {
      await this.loadPasswordModule(passwordDBType.toLowerCase());
      logger.info(
        `Portal initialized with auth=${authType}, userDB=${userDBType}, passwordDB=${passwordDBType}`,
      );
    } else {
      logger.info(
        `Portal initialized with auth=${authType}, userDB=${userDBType}`,
      );
    }

    return true;
  }

  private async loadAuthModule(type: string): Promise<void> {
    const moduleName = `@lemonldap-ng/auth-${type}`;
    try {
      const mod = await import(moduleName);
      const AuthClass = mod.default;
      this.authModule = new AuthClass();
      await this.authModule!.init(this.conf!, this.logger!);
      this.logger!.debug(`Auth module ${type} loaded`);
    } catch (e) {
      throw new Error(`Failed to load auth module ${moduleName}: ${e}`);
    }
  }

  private async loadUserDBModule(type: string): Promise<void> {
    const moduleName = `@lemonldap-ng/userdb-${type}`;
    try {
      const mod = await import(moduleName);
      const UserDBClass = mod.default;
      this.userDBModule = new UserDBClass();
      await this.userDBModule!.init(this.conf!, this.logger!);
      this.logger!.debug(`UserDB module ${type} loaded`);
    } catch (e) {
      throw new Error(`Failed to load userDB module ${moduleName}: ${e}`);
    }
  }

  private async loadPasswordModule(type: string): Promise<void> {
    const moduleName = `@lemonldap-ng/password-${type}`;
    try {
      const mod = await import(moduleName);
      const PasswordClass = mod.default;
      this.passwordModule = new PasswordClass();
      await this.passwordModule!.init(this.conf!, this.logger!);
      this.logger!.debug(`Password module ${type} loaded`);
    } catch (e) {
      throw new Error(`Failed to load password module ${moduleName}: ${e}`);
    }
  }

  /**
   * Get configuration
   */
  getConf(): LLNG_Conf {
    if (!this.conf) throw new Error("Portal not initialized");
    return this.conf;
  }

  /**
   * Get logger
   */
  getLogger(): LLNG_Logger {
    if (!this.logger) throw new Error("Portal not initialized");
    return this.logger;
  }

  /**
   * Get session accessor
   */
  getSessionAccessor(): Session {
    if (!this.sessionAcc) throw new Error("Portal not initialized");
    return this.sessionAcc;
  }

  /**
   * Get auth module
   */
  getAuthModule(): AuthModule {
    if (!this.authModule) throw new Error("Auth module not loaded");
    return this.authModule;
  }

  /**
   * Get userDB module
   */
  getUserDBModule(): UserDBModule {
    if (!this.userDBModule) throw new Error("UserDB module not loaded");
    return this.userDBModule;
  }

  /**
   * Get password module (may be null if not configured)
   */
  getPasswordModule(): PasswordModule | null {
    return this.passwordModule;
  }

  /**
   * Check if password module is available
   */
  hasPasswordModule(): boolean {
    return this.passwordModule !== null;
  }

  /**
   * Get template engine
   */
  getTemplateEngine(): TemplateEngine {
    if (!this.templateEngine)
      throw new Error("Template engine not initialized");
    return this.templateEngine;
  }

  /**
   * Generate a new session ID
   */
  generateSessionId(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<LLNG_Session | null> {
    try {
      const session = await this.sessionAcc!.get(sessionId);
      // Check timeout
      const now = Math.floor(Date.now() / 1000);
      if (this.conf!.timeout && now - session._utime > this.conf!.timeout) {
        this.logger!.debug(`Session ${sessionId} expired`);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Create a new session
   */
  async createSession(
    sessionId: string,
    data: Partial<LLNG_Session>,
  ): Promise<LLNG_Session> {
    const now = Math.floor(Date.now() / 1000);
    const session: LLNG_Session = {
      _session_id: sessionId,
      _utime: now,
      _lastSeen: now,
      ...data,
    };
    await this.sessionAcc!.update(session);
    this.logger!.debug(`Session ${sessionId} created`);
    return session;
  }

  /**
   * Update session
   */
  async updateSession(session: LLNG_Session): Promise<void> {
    session._lastSeen = Math.floor(Date.now() / 1000);
    await this.sessionAcc!.update(session);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const session = await this.sessionAcc!.get(sessionId);
      session._utime = 0; // Mark as expired
      await this.sessionAcc!.update(session);
      this.logger!.debug(`Session ${sessionId} deleted`);
    } catch {
      // Session may not exist
    }
  }

  /**
   * Render a template
   */
  render(template: string, context: Record<string, any> = {}): string {
    return this.templateEngine!.render(template, {
      PORTAL: this.conf?.portal || "/",
      ...context,
    });
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    if (this.authModule?.close) {
      await this.authModule.close();
    }
    if (this.userDBModule?.close) {
      await this.userDBModule.close();
    }
    if (this.passwordModule?.close) {
      await this.passwordModule.close();
    }
    if (this.sessionAcc) {
      await this.sessionAcc.close();
    }
    this.logger?.info("Portal closed");
  }
}

export default Portal;
