import {
  Client,
  Control,
  Attribute,
  Change,
  type SearchResult,
  type Entry,
} from "ldapts";
import type { LLNG_Logger } from "@lemonldap-ng/types";
import type {
  LDAPConfig,
  LDAPSearchOptions,
  LDAPBindResult,
  LDAPEntry,
  LDAPGroupData,
  PasswordModifyResult,
  PasswordModifyOptions,
} from "./types";
import {
  parseLDAPUrls,
  buildFilter,
  getLdapValue,
  getLdapValues,
  convertDerefOption,
  escapeFilterValue,
  mapPpolicyError,
} from "./ldap-utils";
import * as tls from "tls";
import * as fs from "fs";

/**
 * Password Policy Control OID (RFC 3876)
 */
const PPOLICY_CONTROL_OID = "1.3.6.1.4.1.42.2.27.8.5.1";

/**
 * Password Modify Extended Operation OID (RFC 3062)
 */
const PASSWD_MODIFY_OID = "1.3.6.1.4.1.4203.1.11.1";

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = "closed", // Normal operation
  OPEN = "open", // Failing, reject all requests
  HALF_OPEN = "half_open", // Testing if service recovered
}

/**
 * Singleton connection manager for sharing connections
 */
const connectionPool: Map<string, LDAPConnection> = new Map();

/**
 * LDAP Connection manager with resilience features:
 * - Automatic reconnection on failure
 * - Retry with exponential backoff
 * - Circuit breaker to avoid hammering dead servers
 * - Connection pooling and sharing
 */
export class LDAPConnection {
  private client: Client | null = null;
  private conf: LDAPConfig;
  private logger: LLNG_Logger;
  private connected: boolean = false;
  private currentUrl: string = "";
  private currentUrlIndex: number = 0;
  private parsedUrls: ReturnType<typeof parseLDAPUrls> = [];

  // Circuit breaker state
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number = 3;
  private readonly resetTimeout: number = 30000; // 30 seconds

  // Retry configuration
  private readonly maxRetries: number = 3;
  private readonly baseRetryDelay: number = 100; // ms
  private readonly maxRetryDelay: number = 5000; // ms

  // Connection health check
  private lastHealthCheck: number = 0;
  private readonly healthCheckInterval: number = 30000; // 30 seconds

  constructor(conf: LDAPConfig, logger: LLNG_Logger) {
    this.conf = conf;
    this.logger = logger;
    this.parsedUrls = parseLDAPUrls(this.conf.ldapServer);
  }

  /**
   * Get or create a shared connection for a given config
   * Useful for sharing connection between auth and userdb modules
   */
  static getSharedConnection(
    conf: LDAPConfig,
    logger: LLNG_Logger,
  ): LDAPConnection {
    const key = `${conf.ldapServer}|${conf.managerDn || "anonymous"}`;

    let connection = connectionPool.get(key);
    if (!connection) {
      connection = new LDAPConnection(conf, logger);
      connectionPool.set(key, connection);
    }

    return connection;
  }

  /**
   * Close all shared connections
   */
  static async closeAllSharedConnections(): Promise<void> {
    for (const connection of connectionPool.values()) {
      await connection.close();
    }
    connectionPool.clear();
  }

  /**
   * Connect to LDAP server with automatic failover
   */
  async connect(): Promise<void> {
    // Check circuit breaker
    if (!this.canAttemptConnection()) {
      throw new Error(
        `Circuit breaker is open, LDAP connections blocked for ${Math.ceil((this.resetTimeout - (Date.now() - this.lastFailureTime)) / 1000)}s`,
      );
    }

    // Try each server in order
    let lastError: Error | null = null;

    for (let i = 0; i < this.parsedUrls.length; i++) {
      const urlIndex = (this.currentUrlIndex + i) % this.parsedUrls.length;
      const url = this.parsedUrls[urlIndex];

      try {
        await this.connectToServer(
          url.host,
          url.port,
          url.useTLS,
          url.useStartTLS,
        );
        this.currentUrl = `${url.protocol}://${url.host}:${url.port}`;
        this.currentUrlIndex = urlIndex;
        this.onConnectionSuccess();
        this.logger.info(`Connected to LDAP server: ${this.currentUrl}`);
        return;
      } catch (e: any) {
        lastError = e;
        this.logger.warn(
          `Failed to connect to LDAP server ${url.host}:${url.port}: ${e.message || e}`,
        );
      }
    }

    this.onConnectionFailure();
    throw new Error(
      `Failed to connect to any LDAP server: ${lastError?.message || "unknown error"}`,
    );
  }

  /**
   * Check if connection attempt is allowed (circuit breaker)
   */
  private canAttemptConnection(): boolean {
    if (this.circuitState === CircuitState.CLOSED) {
      return true;
    }

    if (this.circuitState === CircuitState.OPEN) {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.circuitState = CircuitState.HALF_OPEN;
        this.logger.info("Circuit breaker entering half-open state");
        return true;
      }
      return false;
    }

    // HALF_OPEN - allow one attempt
    return true;
  }

  /**
   * Handle successful connection
   */
  private onConnectionSuccess(): void {
    this.failureCount = 0;
    this.circuitState = CircuitState.CLOSED;
  }

  /**
   * Handle connection failure
   */
  private onConnectionFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.circuitState = CircuitState.OPEN;
      this.logger.error(
        `Circuit breaker opened after ${this.failureCount} failures`,
      );
    }
  }

  /**
   * Connect to a specific LDAP server
   */
  private async connectToServer(
    host: string,
    port: number,
    useTLS: boolean,
    useStartTLS: boolean,
  ): Promise<void> {
    const tlsOptions: tls.ConnectionOptions = {};

    // Configure TLS options
    if (this.conf.ldapVerify === "none") {
      tlsOptions.rejectUnauthorized = false;
    } else {
      tlsOptions.rejectUnauthorized = true;
    }

    if (this.conf.ldapCAFile) {
      try {
        tlsOptions.ca = fs.readFileSync(this.conf.ldapCAFile);
      } catch (e: any) {
        this.logger.warn(`Failed to read CA file: ${e.message}`);
      }
    }

    if (this.conf.ldapCAPath) {
      try {
        const files = fs.readdirSync(this.conf.ldapCAPath);
        const certs: Buffer[] = [];
        for (const file of files) {
          if (file.endsWith(".pem") || file.endsWith(".crt")) {
            certs.push(fs.readFileSync(`${this.conf.ldapCAPath}/${file}`));
          }
        }
        if (certs.length > 0) {
          tlsOptions.ca = certs;
        }
      } catch (e: any) {
        this.logger.warn(`Failed to read CA path: ${e.message}`);
      }
    }

    const url = useTLS ? `ldaps://${host}:${port}` : `ldap://${host}:${port}`;

    this.client = new Client({
      url,
      timeout: this.conf.ldapTimeout || 10000,
      connectTimeout: this.conf.ldapTimeout || 10000,
      tlsOptions: useTLS ? tlsOptions : undefined,
      strictDN: false,
    });

    // Test connection with a root DSE search
    try {
      await this.client.search("", {
        scope: "base",
        filter: "(objectClass=*)",
        attributes: ["supportedLDAPVersion"],
      });
      this.connected = true;

      // Start TLS if requested
      if (useStartTLS && !useTLS) {
        await this.client.startTLS(tlsOptions);
        this.logger.debug("StartTLS successful");
      }
    } catch (e) {
      if (this.client) {
        try {
          await this.client.unbind();
        } catch {
          // Ignore unbind errors during cleanup
        }
      }
      this.client = null;
      this.connected = false;
      throw e;
    }
  }

  /**
   * Validate connection and reconnect if needed
   * Uses health check interval to avoid excessive checks
   */
  async validateConnection(): Promise<boolean> {
    // Fast path: recently validated
    const now = Date.now();
    if (
      this.connected &&
      this.client &&
      now - this.lastHealthCheck < this.healthCheckInterval
    ) {
      return true;
    }

    if (!this.client || !this.connected) {
      return this.reconnect();
    }

    // Perform actual health check
    try {
      await this.client.search("", {
        scope: "base",
        filter: "(objectClass=*)",
        attributes: ["supportedLDAPVersion"],
      });
      this.lastHealthCheck = now;
      return true;
    } catch {
      this.logger.info("LDAP connection lost, reconnecting...");
      return this.reconnect();
    }
  }

  /**
   * Reconnect with retry logic
   */
  private async reconnect(): Promise<boolean> {
    this.connected = false;
    if (this.client) {
      try {
        await this.client.unbind();
      } catch {
        // Ignore unbind errors
      }
      this.client = null;
    }

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await this.connect();
        return true;
      } catch (e: any) {
        const delay = Math.min(
          this.baseRetryDelay * Math.pow(2, attempt),
          this.maxRetryDelay,
        );
        this.logger.warn(
          `Reconnection attempt ${attempt + 1}/${this.maxRetries} failed, retrying in ${delay}ms: ${e.message}`,
        );

        if (attempt < this.maxRetries - 1) {
          await this.sleep(delay);
        }
      }
    }

    this.logger.error(`Failed to reconnect after ${this.maxRetries} attempts`);
    return false;
  }

  /**
   * Execute operation with automatic retry on connection failure
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Validate connection before operation
      if (!(await this.validateConnection())) {
        throw new Error("LDAP connection unavailable");
      }

      try {
        return await operation();
      } catch (e: any) {
        lastError = e;

        // Check if it's a connection error that warrants retry
        const isConnectionError =
          e.code === "ECONNRESET" ||
          e.code === "ECONNREFUSED" ||
          e.code === "ETIMEDOUT" ||
          e.code === "EPIPE" ||
          e.message?.includes("connection") ||
          e.message?.includes("socket");

        if (isConnectionError && attempt < this.maxRetries) {
          this.logger.warn(
            `${operationName} failed (attempt ${attempt + 1}/${this.maxRetries + 1}), reconnecting: ${e.message}`,
          );
          this.connected = false;
          const delay = Math.min(
            this.baseRetryDelay * Math.pow(2, attempt),
            this.maxRetryDelay,
          );
          await this.sleep(delay);
          continue;
        }

        throw e;
      }
    }

    throw lastError || new Error(`${operationName} failed after retries`);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Bind with manager/service account
   */
  async bind(dn?: string, password?: string): Promise<boolean> {
    return this.withRetry(async () => {
      if (!this.client) {
        throw new Error("LDAP client not connected");
      }

      const bindDn = dn || this.conf.managerDn;
      const bindPassword = password || this.conf.managerPassword;

      if (!bindDn) {
        // Anonymous bind
        try {
          await this.client.bind("", "");
          this.logger.debug("Anonymous LDAP bind successful");
          return true;
        } catch (e: any) {
          this.logger.error(`Anonymous LDAP bind failed: ${e.message || e}`);
          return false;
        }
      }

      try {
        await this.client.bind(bindDn, bindPassword || "");
        this.logger.debug(`LDAP bind successful for ${bindDn}`);
        return true;
      } catch (e: any) {
        this.logger.error(`LDAP bind failed for ${bindDn}: ${e.message || e}`);
        return false;
      }
    }, "bind");
  }

  /**
   * Bind as user to verify password
   * Creates a separate connection to avoid affecting the manager connection
   * Supports Password Policy (RFC 3876) when ldapPpolicyControl is enabled
   */
  async userBind(dn: string, password: string): Promise<LDAPBindResult> {
    // Don't retry user bind - invalid credentials should fail immediately
    if (!this.canAttemptConnection()) {
      return {
        success: false,
        error: "LDAP service temporarily unavailable",
        errorCode: "PE_LDAPCONNECTFAILED",
      };
    }

    try {
      const urls = this.parsedUrls;
      const url = urls[this.currentUrlIndex] || urls[0];

      const tlsOptions: tls.ConnectionOptions = {};
      if (this.conf.ldapVerify === "none") {
        tlsOptions.rejectUnauthorized = false;
      }

      const userClient = new Client({
        url: url.useTLS
          ? `ldaps://${url.host}:${url.port}`
          : `ldap://${url.host}:${url.port}`,
        timeout: this.conf.ldapTimeout || 10000,
        connectTimeout: this.conf.ldapTimeout || 10000,
        tlsOptions: url.useTLS ? tlsOptions : undefined,
        strictDN: false,
      });

      try {
        // Prepare controls array if PPolicy is enabled
        const controls: Control[] = [];
        if (this.conf.ldapPpolicyControl) {
          controls.push(new Control(PPOLICY_CONTROL_OID));
        }

        // Perform bind with optional PPolicy control
        const bindResult = await userClient.bind(
          dn,
          password,
          controls.length > 0 ? controls : undefined,
        );

        // Parse PPolicy response if present
        const result: LDAPBindResult = { success: true };
        if (this.conf.ldapPpolicyControl && bindResult) {
          this.parsePpolicyResponse(bindResult, result);
        }

        await userClient.unbind();
        this.logger.debug(`User bind successful for ${dn}`);
        this.onConnectionSuccess();
        return result;
      } catch (e: any) {
        try {
          await userClient.unbind();
        } catch {
          // Ignore unbind errors
        }

        const resultCode = e.code || e.resultCode;

        // Check for PPolicy error in exception
        if (this.conf.ldapPpolicyControl && e.controls) {
          const ppolicyResult = this.extractPpolicyFromError(e);
          if (ppolicyResult) {
            return ppolicyResult;
          }
        }

        if (resultCode === 49) {
          // Invalid credentials - not a connection issue
          return {
            success: false,
            error: "Invalid credentials",
            errorCode: "PE_BADCREDENTIALS",
          };
        }

        // Connection error during user bind
        if (
          e.code === "ECONNRESET" ||
          e.code === "ECONNREFUSED" ||
          e.code === "ETIMEDOUT"
        ) {
          this.onConnectionFailure();
          return {
            success: false,
            error: "LDAP connection error",
            errorCode: "PE_LDAPCONNECTFAILED",
          };
        }

        this.logger.error(`User bind failed for ${dn}: ${e.message || e}`);
        return {
          success: false,
          error: e.message || "Bind failed",
          errorCode: "PE_LDAPERROR",
        };
      }
    } catch (e: any) {
      this.onConnectionFailure();
      this.logger.error(`User bind error: ${e.message || e}`);
      return {
        success: false,
        error: e.message || "Connection error",
        errorCode: "PE_LDAPCONNECTFAILED",
      };
    }
  }

  /**
   * Parse PPolicy response from successful bind
   */
  private parsePpolicyResponse(response: any, result: LDAPBindResult): void {
    if (!response || !response.controls) return;

    const ppolicyControl = response.controls.find(
      (c: any) => c.type === PPOLICY_CONTROL_OID,
    );
    if (!ppolicyControl || !ppolicyControl.value) return;

    try {
      // Parse the PPolicy response value (BER encoded)
      const value = ppolicyControl.value;
      // The response contains: warning (optional), error (optional)
      // warning: { timeBeforeExpiration | graceAuthNsRemaining }
      // error: passwordExpired | accountLocked | changeAfterReset | etc.

      // Check for grace authentications remaining
      if (value.graceAuthNsRemaining !== undefined) {
        result.ppolicyGrace = value.graceAuthNsRemaining;
        this.logger.debug(
          `PPolicy: grace authentications remaining: ${result.ppolicyGrace}`,
        );
      }

      // Check for time before expiration
      if (value.timeBeforeExpiration !== undefined) {
        result.ppolicyExpire = value.timeBeforeExpiration;
        this.logger.debug(
          `PPolicy: time before expiration: ${result.ppolicyExpire}s`,
        );
      }

      // Check for error
      if (value.error !== undefined) {
        result.ppolicyError = value.error;
        result.errorCode = mapPpolicyError(value.error);
        this.logger.debug(`PPolicy: error code ${value.error}`);
      }
    } catch (e: any) {
      this.logger.warn(`Failed to parse PPolicy response: ${e.message}`);
    }
  }

  /**
   * Extract PPolicy information from bind error
   */
  private extractPpolicyFromError(error: any): LDAPBindResult | null {
    if (!error.controls) return null;

    const ppolicyControl = error.controls.find(
      (c: any) => c.type === PPOLICY_CONTROL_OID,
    );
    if (!ppolicyControl || !ppolicyControl.value) return null;

    try {
      const value = ppolicyControl.value;
      const result: LDAPBindResult = {
        success: false,
        error: error.message || "Authentication failed",
      };

      if (value.error !== undefined) {
        result.ppolicyError = value.error;
        result.errorCode = mapPpolicyError(value.error);
        this.logger.info(
          `PPolicy error: ${result.errorCode} (code ${value.error})`,
        );
      } else {
        result.errorCode = "PE_BADCREDENTIALS";
      }

      // Include grace info if present
      if (value.graceAuthNsRemaining !== undefined) {
        result.ppolicyGrace = value.graceAuthNsRemaining;
      }

      return result;
    } catch {
      return null;
    }
  }

  /**
   * Modify user password
   * Supports standard LDAP modify, SetPassword extended operation (RFC 3062),
   * and Active Directory unicodePwd attribute
   */
  async modifyPassword(
    dn: string,
    newPassword: string,
    oldPassword?: string,
    options?: PasswordModifyOptions,
  ): Promise<PasswordModifyResult> {
    const opts = options || {};
    const useSetPassword =
      opts.useSetPassword ?? this.conf.ldapSetPassword ?? false;
    const changeAsUser =
      opts.changeAsUser ?? this.conf.ldapChangePasswordAsUser ?? false;
    const requireOldPassword = opts.requireOldPassword ?? false;
    const ppolicyControl =
      opts.ppolicyControl ?? this.conf.ldapPpolicyControl ?? false;
    const isAD = opts.isAD ?? false;

    this.logger.debug(
      `Modifying password for ${dn} (setPassword=${useSetPassword}, changeAsUser=${changeAsUser}, isAD=${isAD})`,
    );

    // Check circuit breaker
    if (!this.canAttemptConnection()) {
      return {
        success: false,
        error: "LDAP service temporarily unavailable",
        errorCode: "PE_LDAPCONNECTFAILED",
      };
    }

    try {
      // Active Directory mode
      if (isAD) {
        return await this.modifyPasswordAD(
          dn,
          newPassword,
          oldPassword,
          changeAsUser,
        );
      }

      // SetPassword extended operation (RFC 3062)
      if (useSetPassword) {
        return await this.modifyPasswordExtended(
          dn,
          newPassword,
          oldPassword,
          changeAsUser,
          ppolicyControl,
        );
      }

      // Standard LDAP modify
      return await this.modifyPasswordStandard(
        dn,
        newPassword,
        oldPassword,
        changeAsUser,
        requireOldPassword,
        ppolicyControl,
      );
    } catch (e: any) {
      this.logger.error(`Password modification failed for ${dn}: ${e.message}`);
      return {
        success: false,
        error: e.message || "Password modification failed",
        errorCode: "PE_LDAPERROR",
      };
    }
  }

  /**
   * Modify password using standard LDAP modify operation
   */
  private async modifyPasswordStandard(
    dn: string,
    newPassword: string,
    oldPassword?: string,
    changeAsUser: boolean = false,
    requireOldPassword: boolean = false,
    ppolicyControl: boolean = false,
  ): Promise<PasswordModifyResult> {
    // If we need to verify old password first
    if (requireOldPassword && oldPassword) {
      const verifyResult = await this.userBind(dn, oldPassword);
      if (!verifyResult.success) {
        return {
          success: false,
          error: "Invalid old password",
          errorCode: "PE_BADOLDPASSWORD",
          ppolicyError: verifyResult.ppolicyError,
        };
      }
    }

    // Create controls array
    const controls: Control[] = [];
    if (ppolicyControl) {
      controls.push(new Control(PPOLICY_CONTROL_OID));
    }

    if (changeAsUser && oldPassword) {
      // Bind as user and change password
      return await this.modifyPasswordAsUser(
        dn,
        newPassword,
        oldPassword,
        controls,
      );
    }

    // Change as manager
    return await this.modifyPasswordAsManager(dn, newPassword, controls);
  }

  /**
   * Modify password as the user (bind as user first)
   */
  private async modifyPasswordAsUser(
    dn: string,
    newPassword: string,
    oldPassword: string,
    controls: Control[],
  ): Promise<PasswordModifyResult> {
    const urls = this.parsedUrls;
    const url = urls[this.currentUrlIndex] || urls[0];

    const tlsOptions: tls.ConnectionOptions = {};
    if (this.conf.ldapVerify === "none") {
      tlsOptions.rejectUnauthorized = false;
    }

    const userClient = new Client({
      url: url.useTLS
        ? `ldaps://${url.host}:${url.port}`
        : `ldap://${url.host}:${url.port}`,
      timeout: this.conf.ldapTimeout || 10000,
      connectTimeout: this.conf.ldapTimeout || 10000,
      tlsOptions: url.useTLS ? tlsOptions : undefined,
      strictDN: false,
    });

    try {
      // Bind as user
      await userClient.bind(dn, oldPassword);

      // Modify password
      await userClient.modify(
        dn,
        [
          new Change({
            operation: "replace",
            modification: new Attribute({
              type: "userPassword",
              values: [newPassword],
            }),
          }),
        ],
        controls.length > 0 ? controls : undefined,
      );

      await userClient.unbind();
      this.logger.info(`Password changed successfully for ${dn} (as user)`);
      return { success: true };
    } catch (e: any) {
      try {
        await userClient.unbind();
      } catch {
        // Ignore unbind errors
      }

      return this.handlePasswordModifyError(e);
    }
  }

  /**
   * Modify password as manager
   */
  private async modifyPasswordAsManager(
    dn: string,
    newPassword: string,
    controls: Control[],
  ): Promise<PasswordModifyResult> {
    // Ensure we're connected and bound as manager
    if (!(await this.validateConnection())) {
      return {
        success: false,
        error: "LDAP connection unavailable",
        errorCode: "PE_LDAPCONNECTFAILED",
      };
    }

    if (!(await this.bind())) {
      return {
        success: false,
        error: "Failed to bind as manager",
        errorCode: "PE_WRONGMANAGERACCOUNT",
      };
    }

    try {
      await this.client!.modify(
        dn,
        [
          new Change({
            operation: "replace",
            modification: new Attribute({
              type: "userPassword",
              values: [newPassword],
            }),
          }),
        ],
        controls.length > 0 ? controls : undefined,
      );

      this.logger.info(`Password changed successfully for ${dn} (as manager)`);
      return { success: true };
    } catch (e: any) {
      return this.handlePasswordModifyError(e);
    }
  }

  /**
   * Modify password using SetPassword extended operation (RFC 3062)
   */
  private async modifyPasswordExtended(
    dn: string,
    newPassword: string,
    oldPassword?: string,
    changeAsUser: boolean = false,
    ppolicyControl: boolean = false,
  ): Promise<PasswordModifyResult> {
    // Build the PasswdModifyRequest value (BER encoded)
    // PasswdModifyRequestValue ::= SEQUENCE {
    //   userIdentity    [0]  OCTET STRING OPTIONAL
    //   oldPasswd       [1]  OCTET STRING OPTIONAL
    //   newPasswd       [2]  OCTET STRING OPTIONAL }
    const requestParts: Buffer[] = [];

    // userIdentity [0] - context tag 0, primitive
    const userIdentityBytes = Buffer.from(dn, "utf-8");
    requestParts.push(
      Buffer.from([0x80, userIdentityBytes.length]),
      userIdentityBytes,
    );

    // oldPasswd [1] - context tag 1, primitive
    if (oldPassword) {
      const oldPasswdBytes = Buffer.from(oldPassword, "utf-8");
      requestParts.push(
        Buffer.from([0x81, oldPasswdBytes.length]),
        oldPasswdBytes,
      );
    }

    // newPasswd [2] - context tag 2, primitive
    const newPasswdBytes = Buffer.from(newPassword, "utf-8");
    requestParts.push(
      Buffer.from([0x82, newPasswdBytes.length]),
      newPasswdBytes,
    );

    // Wrap in SEQUENCE
    const innerContent = Buffer.concat(requestParts);
    const requestValue = Buffer.concat([
      Buffer.from([0x30, innerContent.length]),
      innerContent,
    ]);

    // Create controls
    const controls: Control[] = [];
    if (ppolicyControl) {
      controls.push(new Control(PPOLICY_CONTROL_OID));
    }

    if (changeAsUser && oldPassword) {
      // Use a separate connection bound as user
      const urls = this.parsedUrls;
      const url = urls[this.currentUrlIndex] || urls[0];

      const tlsOptions: tls.ConnectionOptions = {};
      if (this.conf.ldapVerify === "none") {
        tlsOptions.rejectUnauthorized = false;
      }

      const userClient = new Client({
        url: url.useTLS
          ? `ldaps://${url.host}:${url.port}`
          : `ldap://${url.host}:${url.port}`,
        timeout: this.conf.ldapTimeout || 10000,
        connectTimeout: this.conf.ldapTimeout || 10000,
        tlsOptions: url.useTLS ? tlsOptions : undefined,
        strictDN: false,
      });

      try {
        await userClient.bind(dn, oldPassword);
        await userClient.exop(PASSWD_MODIFY_OID, requestValue);
        await userClient.unbind();
        this.logger.info(
          `Password changed via SetPassword for ${dn} (as user)`,
        );
        return { success: true };
      } catch (e: any) {
        try {
          await userClient.unbind();
        } catch {
          // Ignore unbind errors
        }
        return this.handlePasswordModifyError(e);
      }
    }

    // Use manager connection
    if (!(await this.validateConnection())) {
      return {
        success: false,
        error: "LDAP connection unavailable",
        errorCode: "PE_LDAPCONNECTFAILED",
      };
    }

    if (!(await this.bind())) {
      return {
        success: false,
        error: "Failed to bind as manager",
        errorCode: "PE_WRONGMANAGERACCOUNT",
      };
    }

    try {
      await this.client!.exop(PASSWD_MODIFY_OID, requestValue);
      this.logger.info(
        `Password changed via SetPassword for ${dn} (as manager)`,
      );
      return { success: true };
    } catch (e: any) {
      return this.handlePasswordModifyError(e);
    }
  }

  /**
   * Modify password for Active Directory
   * Uses unicodePwd attribute with UTF-16LE encoding
   */
  private async modifyPasswordAD(
    dn: string,
    newPassword: string,
    oldPassword?: string,
    changeAsUser: boolean = false,
  ): Promise<PasswordModifyResult> {
    // AD requires password to be quoted and UTF-16LE encoded
    const encodeADPassword = (pwd: string): Buffer => {
      const quotedPwd = `"${pwd}"`;
      return Buffer.from(quotedPwd, "utf16le");
    };

    const newPwdEncoded = encodeADPassword(newPassword);

    if (changeAsUser && oldPassword) {
      // When changing as user in AD, we need to delete old and add new in one operation
      const oldPwdEncoded = encodeADPassword(oldPassword);

      const urls = this.parsedUrls;
      const url = urls[this.currentUrlIndex] || urls[0];

      const tlsOptions: tls.ConnectionOptions = {};
      if (this.conf.ldapVerify === "none") {
        tlsOptions.rejectUnauthorized = false;
      }

      // AD password changes REQUIRE TLS/SSL
      const userClient = new Client({
        url: url.useTLS
          ? `ldaps://${url.host}:${url.port}`
          : `ldap://${url.host}:${url.port}`,
        timeout: this.conf.ldapTimeout || 10000,
        connectTimeout: this.conf.ldapTimeout || 10000,
        tlsOptions: url.useTLS ? tlsOptions : undefined,
        strictDN: false,
      });

      try {
        await userClient.bind(dn, oldPassword);

        // Delete old, add new in single modify
        await userClient.modify(dn, [
          new Change({
            operation: "delete",
            modification: new Attribute({
              type: "unicodePwd",
              values: [oldPwdEncoded.toString("base64")],
            }),
          }),
          new Change({
            operation: "add",
            modification: new Attribute({
              type: "unicodePwd",
              values: [newPwdEncoded.toString("base64")],
            }),
          }),
        ]);

        await userClient.unbind();
        this.logger.info(`AD password changed for ${dn} (as user)`);
        return { success: true };
      } catch (e: any) {
        try {
          await userClient.unbind();
        } catch {
          // Ignore unbind errors
        }
        return this.handleADPasswordError(e);
      }
    }

    // Change as manager - just replace
    if (!(await this.validateConnection())) {
      return {
        success: false,
        error: "LDAP connection unavailable",
        errorCode: "PE_LDAPCONNECTFAILED",
      };
    }

    if (!(await this.bind())) {
      return {
        success: false,
        error: "Failed to bind as manager",
        errorCode: "PE_WRONGMANAGERACCOUNT",
      };
    }

    try {
      await this.client!.modify(dn, [
        new Change({
          operation: "replace",
          modification: new Attribute({
            type: "unicodePwd",
            values: [newPwdEncoded.toString("base64")],
          }),
        }),
      ]);

      this.logger.info(`AD password changed for ${dn} (as manager)`);
      return { success: true };
    } catch (e: any) {
      return this.handleADPasswordError(e);
    }
  }

  /**
   * Handle password modification errors
   */
  private handlePasswordModifyError(error: any): PasswordModifyResult {
    const resultCode = error.code || error.resultCode;

    // Check for PPolicy errors
    if (error.controls) {
      const ppolicyControl = error.controls.find(
        (c: any) => c.type === PPOLICY_CONTROL_OID,
      );
      if (ppolicyControl?.value?.error !== undefined) {
        return {
          success: false,
          error: error.message || "Password policy violation",
          errorCode: mapPpolicyError(ppolicyControl.value.error),
          ppolicyError: ppolicyControl.value.error,
        };
      }
    }

    // LDAP error codes
    switch (resultCode) {
      case 49: // Invalid credentials
        return {
          success: false,
          error: "Invalid credentials",
          errorCode: "PE_BADOLDPASSWORD",
        };
      case 50: // Insufficient access
        return {
          success: false,
          error: "Insufficient access rights",
          errorCode: "PE_LDAPERROR",
        };
      case 53: // Unwilling to perform (often password policy)
        return {
          success: false,
          error: error.message || "Server unwilling to perform",
          errorCode: "PE_PP_PASSWORD_MOD_NOT_ALLOWED",
        };
      case 19: // Constraint violation (password policy)
        return {
          success: false,
          error: error.message || "Password constraint violation",
          errorCode: "PE_PP_INSUFFICIENT_PASSWORD_QUALITY",
        };
      default:
        return {
          success: false,
          error: error.message || "Password modification failed",
          errorCode: "PE_LDAPERROR",
        };
    }
  }

  /**
   * Handle Active Directory specific password errors
   */
  private handleADPasswordError(error: any): PasswordModifyResult {
    const message = error.message || "";

    // AD-specific error codes in error message
    if (message.includes("52e") || message.includes("data 52e")) {
      return {
        success: false,
        error: "Invalid credentials",
        errorCode: "PE_BADOLDPASSWORD",
      };
    }
    if (message.includes("532") || message.includes("data 532")) {
      return {
        success: false,
        error: "Password expired",
        errorCode: "PE_PP_PASSWORD_EXPIRED",
      };
    }
    if (message.includes("773") || message.includes("data 773")) {
      return {
        success: false,
        error: "Must change password",
        errorCode: "PE_PP_CHANGE_AFTER_RESET",
      };
    }
    if (message.includes("775") || message.includes("data 775")) {
      return {
        success: false,
        error: "Account locked",
        errorCode: "PE_PP_ACCOUNT_LOCKED",
      };
    }
    if (message.includes("52d") || message.includes("data 52d")) {
      return {
        success: false,
        error: "Password does not meet complexity requirements",
        errorCode: "PE_PP_INSUFFICIENT_PASSWORD_QUALITY",
      };
    }

    return this.handlePasswordModifyError(error);
  }

  /**
   * Set password reset attribute to force password change at next login
   */
  async setPasswordResetAttribute(dn: string): Promise<boolean> {
    if (!this.conf.ldapUsePasswordResetAttribute) {
      return true; // Not configured, skip
    }

    const resetAttr = this.conf.ldapPasswordResetAttribute || "pwdReset";
    const resetValue = this.conf.ldapPasswordResetAttributeValue || "TRUE";

    if (!(await this.validateConnection())) {
      return false;
    }

    if (!(await this.bind())) {
      return false;
    }

    try {
      await this.client!.modify(dn, [
        new Change({
          operation: "replace",
          modification: new Attribute({
            type: resetAttr,
            values: [resetValue],
          }),
        }),
      ]);
      this.logger.info(`Password reset attribute set for ${dn}`);
      return true;
    } catch (e: any) {
      this.logger.error(
        `Failed to set password reset attribute for ${dn}: ${e.message}`,
      );
      return false;
    }
  }

  /**
   * For Active Directory: set pwdLastSet to 0 to force password change
   */
  async setADForcePasswordChange(dn: string): Promise<boolean> {
    if (!(await this.validateConnection())) {
      return false;
    }

    if (!(await this.bind())) {
      return false;
    }

    try {
      await this.client!.modify(dn, [
        new Change({
          operation: "replace",
          modification: new Attribute({
            type: "pwdLastSet",
            values: ["0"],
          }),
        }),
      ]);
      this.logger.info(`AD pwdLastSet set to 0 for ${dn}`);
      return true;
    } catch (e: any) {
      this.logger.error(`Failed to set AD pwdLastSet for ${dn}: ${e.message}`);
      return false;
    }
  }

  /**
   * Search LDAP directory with automatic retry
   */
  async search(options: LDAPSearchOptions): Promise<LDAPEntry[]> {
    return this.withRetry(async () => {
      if (!this.client) {
        throw new Error("LDAP client not connected");
      }

      const base = options.base || this.conf.ldapBase;
      const scope = options.scope || "sub";
      const deref = convertDerefOption(
        options.deref || this.conf.ldapSearchDeref,
      );

      this.logger.debug(
        `LDAP search: base=${base}, scope=${scope}, filter=${options.filter}`,
      );

      const result: SearchResult = await this.client.search(base, {
        scope,
        filter: options.filter,
        attributes: options.attributes,
        derefAliases: deref,
        sizeLimit: options.sizeLimit || 0,
        timeLimit: options.timeLimit || 0,
      });

      return result.searchEntries.map((entry: Entry) => {
        const ldapEntry: LDAPEntry = { dn: entry.dn };

        for (const [key, value] of Object.entries(entry)) {
          if (key !== "dn") {
            ldapEntry[key] = value as string | string[];
          }
        }

        return ldapEntry;
      });
    }, "search");
  }

  /**
   * Search for user with filter template
   */
  async searchUser(
    username: string,
    attributes?: string[],
  ): Promise<LDAPEntry | null> {
    const filterTemplate =
      this.conf.AuthLDAPFilter ||
      this.conf.LDAPFilter ||
      "(&(uid=$user)(objectClass=inetOrgPerson))";
    const filter = buildFilter(filterTemplate, username);

    const attrs = attributes || this.getExportedAttributes();

    const results = await this.search({
      filter,
      attributes: attrs,
      sizeLimit: 2,
    });

    if (results.length === 0) {
      this.logger.debug(`User not found: ${username}`);
      return null;
    }

    if (results.length > 1) {
      this.logger.warn(`Multiple users found for: ${username}`);
      return null;
    }

    return results[0];
  }

  /**
   * Get list of attributes to export based on config
   */
  getExportedAttributes(): string[] {
    const attrs = new Set<string>();

    if (this.conf.ldapExportedVars) {
      for (const ldapAttr of Object.values(this.conf.ldapExportedVars)) {
        attrs.add(ldapAttr);
      }
    }

    if (this.conf.exportedVars) {
      for (const attr of Object.values(this.conf.exportedVars)) {
        attrs.add(attr);
      }
    }

    attrs.add("uid");
    attrs.add("cn");
    attrs.add("mail");
    attrs.add("sn");
    attrs.add("givenName");

    return Array.from(attrs);
  }

  /**
   * Search for groups containing a user
   */
  async searchGroups(
    userValue: string,
    dupCheck: Set<string> = new Set(),
  ): Promise<Record<string, LDAPGroupData>> {
    if (!this.conf.ldapGroupBase) {
      return {};
    }

    const groupObjectClass = this.conf.ldapGroupObjectClass || "groupOfNames";
    const memberAttr = this.conf.ldapGroupAttributeName || "member";
    const groupNameAttr =
      this.conf.ldapGroupAttributeNameSearch?.split(/\s+/)[0] || "cn";

    const escapedValue = escapeFilterValue(userValue);
    const filter = `(&(objectClass=${groupObjectClass})(${memberAttr}=${escapedValue}))`;

    const searchAttrs = this.conf.ldapGroupAttributeNameSearch?.split(
      /\s+/,
    ) || ["cn"];

    if (this.conf.ldapGroupRecursive && this.conf.ldapGroupAttributeNameGroup) {
      searchAttrs.push(this.conf.ldapGroupAttributeNameGroup);
    }

    const groups: Record<string, LDAPGroupData> = {};

    try {
      const results = await this.search({
        base: this.conf.ldapGroupBase,
        filter,
        attributes: searchAttrs,
      });

      for (const entry of results) {
        const groupName = getLdapValue(entry, groupNameAttr);
        if (!groupName || dupCheck.has(groupName)) {
          continue;
        }

        dupCheck.add(groupName);

        const groupData: LDAPGroupData = {
          name: groupName,
          dn: entry.dn,
        };

        for (const attr of searchAttrs) {
          if (entry[attr]) {
            groupData[attr] = entry[attr];
          }
        }

        groups[groupName] = groupData;

        if (
          this.conf.ldapGroupRecursive &&
          this.conf.ldapGroupAttributeNameGroup
        ) {
          const parentValue = getLdapValue(
            entry,
            this.conf.ldapGroupAttributeNameGroup,
          );
          if (parentValue && !dupCheck.has(parentValue)) {
            const parentGroups = await this.searchGroups(parentValue, dupCheck);
            Object.assign(groups, parentGroups);
          }
        }
      }
    } catch (e: any) {
      this.logger.error(`Group search failed: ${e.message || e}`);
    }

    return groups;
  }

  /**
   * Get attribute value from entry
   */
  getLdapValue(entry: LDAPEntry, attribute: string): string {
    return getLdapValue(entry, attribute, this.conf.multiValuesSeparator);
  }

  /**
   * Get attribute values as array from entry
   */
  getLdapValues(entry: LDAPEntry, attribute: string): string[] {
    return getLdapValues(entry, attribute);
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.unbind();
      } catch {
        // Ignore unbind errors during close
      }
      this.client = null;
      this.connected = false;
      this.logger.debug("LDAP connection closed");
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Get current server URL
   */
  getCurrentUrl(): string {
    return this.currentUrl;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Reset circuit breaker (for testing or manual recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitState = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
