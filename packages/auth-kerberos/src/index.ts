/**
 * Kerberos/GSSAPI Authentication Module for LemonLDAP::NG
 *
 * Authenticates users via Kerberos tickets using HTTP Negotiate (SPNEGO).
 * Requires the optional `kerberos` npm package and a properly configured
 * Kerberos environment (keytab, KDC, etc.).
 *
 * Configuration options:
 * - krbKeytab: Path to the keytab file (or use KRB5_KTNAME env var)
 * - krbRemoveDomain: Remove @REALM from username (default: true)
 * - krbAllowedDomains: List of allowed Kerberos realms (comma-separated or array)
 * - krbByJs: Enable JavaScript-based authentication flow
 * - KrbAuthnLevel: Authentication level for Kerberos auth (default: 3)
 *
 * HTTP Flow:
 * 1. Client sends request without Authorization header
 * 2. Server returns 401 with "WWW-Authenticate: Negotiate"
 * 3. Client sends request with "Authorization: Negotiate <base64-token>"
 * 4. Server validates token via GSSAPI and returns username
 */

import { Request, Response } from "express";

/**
 * Kerberos library interface (optional dependency)
 * This matches the 'kerberos' npm package API
 */
interface KerberosModule {
  initializeServer: (
    service: string,
    callback: (err: Error | null, ctx: ServerContext | null) => void,
  ) => void;
}

interface ServerContext {
  step: (
    token: string,
    callback: (err: Error | null, response: string | null) => void,
  ) => void;
  username: string;
}

/**
 * Configuration interface for Kerberos authentication
 */
export interface KerberosAuthConfig {
  /** Path to keytab file (or use KRB5_KTNAME env var) */
  krbKeytab?: string;
  /** Remove @REALM from username (default: true) */
  krbRemoveDomain?: boolean;
  /** Allowed Kerberos realms (comma-separated string or array) */
  krbAllowedDomains?: string | string[];
  /** Enable JavaScript-based authentication */
  krbByJs?: boolean;
  /** Authentication level for Kerberos auth (default: 3) */
  KrbAuthnLevel?: number;
  /** Service principal name (default: HTTP) */
  krbServiceName?: string;
  /** Portal URL */
  portal?: string;
}

/**
 * Logger interface
 */
export interface Logger {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  notice: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  user?: string;
  realm?: string;
  error?: string;
  errorCode?: string;
  authenticationLevel?: number;
  /** Response token for SPNEGO continuation */
  responseToken?: string;
}

/**
 * Default authentication level for Kerberos
 */
const DEFAULT_KRB_AUTHN_LEVEL = 3;

/**
 * Default service principal name
 */
const DEFAULT_SERVICE_NAME = "HTTP";

/**
 * Kerberos Authentication Class
 */
export class KerberosAuth {
  public readonly name = "Kerberos";
  private conf!: KerberosAuthConfig;
  private logger!: Logger;
  private kerberos: KerberosModule | null = null;
  private allowedDomains: string[] = [];

  /**
   * Initialize the Kerberos authentication module
   */
  async init(conf: KerberosAuthConfig, logger: Logger): Promise<void> {
    this.conf = conf;
    this.logger = logger;

    // Parse allowed domains
    if (conf.krbAllowedDomains) {
      if (Array.isArray(conf.krbAllowedDomains)) {
        this.allowedDomains = conf.krbAllowedDomains.map((d) =>
          d.toUpperCase(),
        );
      } else {
        this.allowedDomains = conf.krbAllowedDomains
          .split(/[\s,;]+/)
          .filter((d) => d)
          .map((d) => d.toUpperCase());
      }
    }

    // Set keytab environment variable if specified
    if (conf.krbKeytab) {
      process.env.KRB5_KTNAME = conf.krbKeytab;
      logger.info(`Kerberos auth: Using keytab ${conf.krbKeytab}`);
    }

    // Try to load kerberos module (optional dependency)
    try {
      // Dynamic import with type assertion to handle optional dependency

      this.kerberos = require("kerberos") as KerberosModule;
      logger.info("Kerberos auth initialized with GSSAPI support");
    } catch {
      logger.warn(
        "Kerberos auth: 'kerberos' module not available. " +
          "Install with: npm install kerberos",
      );
      this.kerberos = null;
    }

    if (this.allowedDomains.length > 0) {
      logger.info(
        `Kerberos auth: Allowed realms: ${this.allowedDomains.join(", ")}`,
      );
    }
  }

  /**
   * Check if Kerberos library is available
   */
  isAvailable(): boolean {
    return this.kerberos !== null;
  }

  /**
   * Extract Negotiate token from Authorization header
   */
  extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const match = authHeader.match(/^Negotiate\s+(.+)$/i);
    return match ? match[1] : null;
  }

  /**
   * Check if realm is allowed
   */
  isRealmAllowed(realm: string): boolean {
    if (this.allowedDomains.length === 0) {
      return true; // No restrictions
    }
    return this.allowedDomains.includes(realm.toUpperCase());
  }

  /**
   * Extract username and realm from Kerberos principal
   * Format: user@REALM or user (without realm)
   */
  parseUsername(principal: string): { user: string; realm: string | null } {
    const atIndex = principal.lastIndexOf("@");
    if (atIndex === -1) {
      return { user: principal, realm: null };
    }
    return {
      user: principal.substring(0, atIndex),
      realm: principal.substring(atIndex + 1),
    };
  }

  /**
   * Get final username based on configuration
   */
  getFinalUsername(principal: string): { user: string; realm: string | null } {
    const { user, realm } = this.parseUsername(principal);

    // By default, remove domain from username
    const removeDomain = this.conf.krbRemoveDomain !== false;

    if (removeDomain) {
      return { user, realm };
    }

    return { user: principal, realm };
  }

  /**
   * Authenticate user via Kerberos/SPNEGO
   *
   * Returns a result indicating:
   * - success with user info
   * - need_negotiate: client needs to provide Negotiate token
   * - failure with error
   */
  async authenticate(req: Request): Promise<AuthResult> {
    // Check if kerberos library is available
    if (!this.kerberos) {
      return {
        success: false,
        error: "Kerberos library not available",
        errorCode: "PE_ERROR",
      };
    }

    // Extract Negotiate token
    const token = this.extractToken(req);

    if (!token) {
      this.logger.debug("Kerberos auth: No Negotiate token in request");
      return {
        success: false,
        error: "Kerberos authentication required",
        errorCode: "PE_SENDRESPONSE", // Special code to trigger 401 response
      };
    }

    // Validate token via GSSAPI
    const serviceName = this.conf.krbServiceName || DEFAULT_SERVICE_NAME;

    try {
      const result = await this.validateToken(serviceName, token);

      if (!result.success) {
        return result;
      }

      const { user, realm } = this.getFinalUsername(result.user!);

      // Check realm if configured
      if (realm && !this.isRealmAllowed(realm)) {
        this.logger.warn(`Kerberos auth: Realm ${realm} not allowed`);
        return {
          success: false,
          error: `Kerberos realm ${realm} not allowed`,
          errorCode: "PE_BADCREDENTIALS",
        };
      }

      const authLevel = this.conf.KrbAuthnLevel ?? DEFAULT_KRB_AUTHN_LEVEL;

      this.logger.info(
        `Kerberos auth: User ${user} authenticated via Kerberos${realm ? ` (${realm})` : ""}`,
      );

      return {
        success: true,
        user,
        realm: realm || undefined,
        authenticationLevel: authLevel,
        responseToken: result.responseToken,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Kerberos auth error: ${error.message}`);
      return {
        success: false,
        error: "Kerberos authentication failed",
        errorCode: "PE_BADCREDENTIALS",
      };
    }
  }

  /**
   * Validate Kerberos token via GSSAPI
   */
  private async validateToken(
    serviceName: string,
    token: string,
  ): Promise<AuthResult> {
    return new Promise((resolve) => {
      this.kerberos!.initializeServer(
        serviceName,
        (err: Error | null, ctx: ServerContext | null) => {
          if (err) {
            this.logger.error(
              `Kerberos initializeServer error: ${err.message}`,
            );
            resolve({
              success: false,
              error: "Failed to initialize Kerberos server",
              errorCode: "PE_ERROR",
            });
            return;
          }

          if (!ctx) {
            resolve({
              success: false,
              error: "Failed to create Kerberos context",
              errorCode: "PE_ERROR",
            });
            return;
          }

          ctx.step(token, (stepErr: Error | null, response: string | null) => {
            if (stepErr) {
              this.logger.debug(`Kerberos step error: ${stepErr.message}`);
              resolve({
                success: false,
                error: "Invalid Kerberos token",
                errorCode: "PE_BADCREDENTIALS",
              });
              return;
            }

            const username = ctx.username;
            if (!username) {
              resolve({
                success: false,
                error: "Failed to extract username from token",
                errorCode: "PE_BADCREDENTIALS",
              });
              return;
            }

            resolve({
              success: true,
              user: username,
              responseToken: response || undefined,
            });
          });
        },
      );
    });
  }

  /**
   * Send 401 response with WWW-Authenticate: Negotiate header
   */
  sendNegotiateChallenge(res: Response, responseToken?: string): void {
    if (responseToken) {
      res.setHeader("WWW-Authenticate", `Negotiate ${responseToken}`);
    } else {
      res.setHeader("WWW-Authenticate", "Negotiate");
    }
    res.status(401);
  }

  /**
   * Get authentication level for Kerberos
   */
  getAuthenticationLevel(): number {
    return this.conf.KrbAuthnLevel ?? DEFAULT_KRB_AUTHN_LEVEL;
  }

  /**
   * Check if JavaScript-based authentication is enabled
   */
  isJsEnabled(): boolean {
    return !!this.conf.krbByJs;
  }

  /**
   * Close the module (no-op for Kerberos)
   */
  async close(): Promise<void> {
    this.logger.debug("Kerberos auth module closed");
  }
}

/**
 * Factory function to create KerberosAuth instance
 */
export function createKerberosAuth(): KerberosAuth {
  return new KerberosAuth();
}

export default KerberosAuth;
