/**
 * SSL Client Certificate Authentication Module for LemonLDAP::NG
 *
 * Authenticates users via SSL/TLS client certificates.
 * The web server (nginx, Apache) must be configured to request and verify
 * client certificates, then pass the certificate information via environment
 * variables or headers.
 *
 * Configuration options:
 * - SSLVar: Environment variable/header containing the username
 *           (default: SSL_CLIENT_S_DN_Email)
 * - SSLIssuerVar: Environment variable/header containing the issuer DN
 *                 (default: SSL_CLIENT_I_DN)
 * - SSLVarIf: Map of issuer patterns to username fields
 *             e.g., { "issuer1": "SSL_CLIENT_S_DN_CN", "issuer2": "SSL_CLIENT_S_DN_UID" }
 * - SSLAuthnLevel: Authentication level for SSL auth (default: 5)
 * - sslByAjax: Enable AJAX-based SSL authentication
 * - sslHost: URL for AJAX SSL authentication endpoint
 */

import { Request } from "express";

/**
 * Configuration interface for SSL authentication
 */
export interface SSLAuthConfig {
  /** Environment variable for username (default: SSL_CLIENT_S_DN_Email) */
  SSLVar?: string;
  /** Environment variable for issuer (default: SSL_CLIENT_I_DN) */
  SSLIssuerVar?: string;
  /** Map issuer patterns to different username fields */
  SSLVarIf?: Record<string, string>;
  /** Authentication level for SSL auth (default: 5) */
  SSLAuthnLevel?: number;
  /** Enable AJAX-based SSL authentication */
  sslByAjax?: boolean;
  /** URL for AJAX SSL authentication endpoint */
  sslHost?: string;
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
  error?: string;
  errorCode?: string;
  authenticationLevel?: number;
  /** Issuer DN from certificate */
  issuer?: string;
}

/**
 * SSL environment variables typically set by web server
 */
export interface SSLEnvironment {
  SSL_CLIENT_S_DN?: string;
  SSL_CLIENT_S_DN_CN?: string;
  SSL_CLIENT_S_DN_Email?: string;
  SSL_CLIENT_S_DN_UID?: string;
  SSL_CLIENT_S_DN_O?: string;
  SSL_CLIENT_S_DN_OU?: string;
  SSL_CLIENT_I_DN?: string;
  SSL_CLIENT_I_DN_CN?: string;
  SSL_CLIENT_I_DN_O?: string;
  SSL_CLIENT_I_DN_OU?: string;
  SSL_CLIENT_VERIFY?: string;
  SSL_CLIENT_CERT?: string;
  [key: string]: string | undefined;
}

/**
 * Default SSL environment variable for username
 */
const DEFAULT_SSL_VAR = "SSL_CLIENT_S_DN_Email";

/**
 * Default SSL environment variable for issuer
 */
const DEFAULT_SSL_ISSUER_VAR = "SSL_CLIENT_I_DN";

/**
 * Default authentication level for SSL
 */
const DEFAULT_SSL_AUTHN_LEVEL = 5;

/**
 * SSL Client Certificate Authentication Class
 */
export class SSLAuth {
  public readonly name = "SSL";
  private conf!: SSLAuthConfig;
  private logger!: Logger;

  /**
   * Initialize the SSL authentication module
   */
  async init(conf: SSLAuthConfig, logger: Logger): Promise<void> {
    this.conf = conf;
    this.logger = logger;

    logger.info(
      `SSL auth initialized, using ${conf.SSLVar || DEFAULT_SSL_VAR} for user identification`,
    );

    if (conf.SSLVarIf) {
      const count = Object.keys(conf.SSLVarIf).length;
      logger.info(
        `SSL auth: ${count} issuer-based variable mapping(s) configured`,
      );
    }
  }

  /**
   * Get SSL environment variables from request
   *
   * These can come from:
   * - Process environment (when using fastcgi or similar)
   * - Request headers (when proxied from nginx/Apache)
   * - Request object properties (when set by middleware)
   *
   * All keys are stored in uppercase for case-insensitive matching.
   */
  getSSLEnv(req: Request): SSLEnvironment {
    const env: SSLEnvironment = {};

    // Check process.env first
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SSL_CLIENT_") || key.startsWith("SSL_SERVER_")) {
        env[key.toUpperCase()] = process.env[key];
      }
    }

    // Check request headers (nginx sets these as HTTP_SSL_CLIENT_*)
    // Headers are lowercased and use hyphens
    if (req.headers) {
      for (const [header, value] of Object.entries(req.headers)) {
        if (typeof value === "string") {
          // Convert header format to env format
          // e.g., ssl-client-s-dn-email -> SSL_CLIENT_S_DN_EMAIL
          if (
            header.startsWith("ssl-client-") ||
            header.startsWith("ssl-server-")
          ) {
            const envKey = header.toUpperCase().replace(/-/g, "_");
            env[envKey] = value;
          }
          // Also check x-ssl-* headers (common proxy pattern)
          if (
            header.startsWith("x-ssl-client-") ||
            header.startsWith("x-ssl-server-")
          ) {
            const envKey = header.substring(2).toUpperCase().replace(/-/g, "_");
            env[envKey] = value;
          }
        }
      }
    }

    // Check custom request properties (set by middleware)
    const reqAny = req as unknown as Record<string, unknown>;
    if (reqAny.sslEnv && typeof reqAny.sslEnv === "object") {
      // Store with uppercase keys for consistency
      for (const [key, value] of Object.entries(
        reqAny.sslEnv as Record<string, string>,
      )) {
        env[key.toUpperCase()] = value;
      }
    }

    return env;
  }

  /**
   * Get value from SSL environment (case-insensitive key lookup)
   */
  private getEnvValue(sslEnv: SSLEnvironment, key: string): string | undefined {
    return sslEnv[key.toUpperCase()];
  }

  /**
   * Get the SSL variable name to use for extracting the username
   *
   * If SSLVarIf is configured, the issuer is checked against patterns
   * to determine which variable to use.
   */
  getSSLVar(issuer: string | undefined): string {
    const sslVar = this.conf.SSLVar || DEFAULT_SSL_VAR;

    if (!issuer || !this.conf.SSLVarIf) {
      return sslVar;
    }

    // Check each pattern in SSLVarIf
    for (const [pattern, varName] of Object.entries(this.conf.SSLVarIf)) {
      // Pattern matching - can be simple substring or regex-like
      if (issuer.includes(pattern)) {
        this.logger.debug(
          `SSL auth: Issuer matches pattern '${pattern}', using ${varName}`,
        );
        return varName;
      }
    }

    return sslVar;
  }

  /**
   * Extract user from SSL environment
   */
  extractUser(sslEnv: SSLEnvironment): {
    user: string | null;
    issuer: string | undefined;
  } {
    const issuerVar = this.conf.SSLIssuerVar || DEFAULT_SSL_ISSUER_VAR;
    const issuer = this.getEnvValue(sslEnv, issuerVar);

    const sslVar = this.getSSLVar(issuer);
    const user = this.getEnvValue(sslEnv, sslVar) || null;

    return { user, issuer };
  }

  /**
   * Authenticate user via SSL client certificate
   *
   * The web server must be configured to:
   * 1. Request client certificates (ssl_verify_client)
   * 2. Pass certificate info via environment variables or headers
   */
  async authenticate(req: Request): Promise<AuthResult> {
    const sslEnv = this.getSSLEnv(req);

    // Check if SSL verification was successful
    const verify = this.getEnvValue(sslEnv, "SSL_CLIENT_VERIFY");
    if (verify && verify !== "SUCCESS" && verify !== "NONE") {
      this.logger.debug(
        `SSL auth: Client certificate verification failed: ${verify}`,
      );
      return {
        success: false,
        error: "SSL certificate verification failed",
        errorCode: "PE_CERTIFICATEREQUIRED",
      };
    }

    const { user, issuer } = this.extractUser(sslEnv);

    if (!user) {
      const sslVar = this.getSSLVar(issuer);
      this.logger.debug(`SSL auth: No user found in ${sslVar}`);
      return {
        success: false,
        error: "No valid SSL certificate provided",
        errorCode: "PE_CERTIFICATEREQUIRED",
      };
    }

    const authLevel = this.conf.SSLAuthnLevel ?? DEFAULT_SSL_AUTHN_LEVEL;

    this.logger.info(
      `SSL auth: User ${user} authenticated via SSL certificate`,
    );

    return {
      success: true,
      user,
      issuer,
      authenticationLevel: authLevel,
    };
  }

  /**
   * Get authentication level for SSL
   */
  getAuthenticationLevel(): number {
    return this.conf.SSLAuthnLevel ?? DEFAULT_SSL_AUTHN_LEVEL;
  }

  /**
   * Check if AJAX-based authentication is enabled
   */
  isAjaxEnabled(): boolean {
    return !!this.conf.sslByAjax;
  }

  /**
   * Get the SSL authentication URL for AJAX requests
   */
  getAjaxUrl(): string | undefined {
    return this.conf.sslHost;
  }

  /**
   * Close the module (no-op for SSL)
   */
  async close(): Promise<void> {
    this.logger.debug("SSL auth module closed");
  }
}

/**
 * Factory function to create SSLAuth instance
 */
export function createSSLAuth(): SSLAuth {
  return new SSLAuth();
}

export default SSLAuth;
