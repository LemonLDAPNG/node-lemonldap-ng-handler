/**
 * DBI (SQL) Authentication module for LemonLDAP::NG
 *
 * Provides authentication against SQL databases (SQLite, PostgreSQL, MySQL, Oracle).
 * Uses the perl-dbi package for database connectivity via Knex.js.
 */

import type { Request } from "express";
import type { LLNG_Conf, LLNG_Logger } from "@lemonldap-ng/types";
import PerlDBI, { type PerlDBI_Client } from "perl-dbi";
import crypto from "crypto";

/**
 * Authentication credentials
 */
export interface Credentials {
  user: string;
  password: string;
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * DBI configuration extracted from LLNG_Conf
 */
export interface DBIAuthConfig {
  dbiAuthChain: string;
  dbiAuthUser?: string;
  dbiAuthPassword?: string;
  dbiAuthTable: string;
  dbiAuthLoginCol: string;
  dbiAuthPasswordCol: string;
  dbiAuthPasswordHash?: string;
  dbiDynamicHashEnabled?: boolean;
  dbiDynamicHashValidSchemes?: string;
  dbiDynamicHashValidSaltedSchemes?: string;
  userPivot?: string;
}

/**
 * Extract DBI auth configuration from LLNG_Conf
 */
export function extractDBIAuthConfig(conf: LLNG_Conf): DBIAuthConfig {
  return {
    dbiAuthChain: conf.dbiAuthChain as string,
    dbiAuthUser: conf.dbiAuthUser as string | undefined,
    dbiAuthPassword: conf.dbiAuthPassword as string | undefined,
    dbiAuthTable: (conf.dbiAuthTable || conf.dbiUserTable) as string,
    dbiAuthLoginCol: (conf.dbiAuthLoginCol || conf.userPivot) as string,
    dbiAuthPasswordCol: conf.dbiAuthPasswordCol as string,
    dbiAuthPasswordHash: conf.dbiAuthPasswordHash as string | undefined,
    dbiDynamicHashEnabled: conf.dbiDynamicHashEnabled as boolean | undefined,
    dbiDynamicHashValidSchemes: conf.dbiDynamicHashValidSchemes as
      | string
      | undefined,
    dbiDynamicHashValidSaltedSchemes: conf.dbiDynamicHashValidSaltedSchemes as
      | string
      | undefined,
    userPivot: conf.userPivot as string | undefined,
  };
}

/**
 * Hash password using specified algorithm
 * Supports: sha, sha256, sha512, md5, or empty for plaintext
 */
function hashPassword(password: string, hash?: string): string {
  if (!hash || hash === "") {
    return password;
  }

  const algo = hash.toLowerCase();
  if (["sha", "sha1"].includes(algo)) {
    return crypto.createHash("sha1").update(password).digest("hex");
  }
  if (algo === "sha256") {
    return crypto.createHash("sha256").update(password).digest("hex");
  }
  if (algo === "sha512") {
    return crypto.createHash("sha512").update(password).digest("hex");
  }
  if (algo === "md5") {
    return crypto.createHash("md5").update(password).digest("hex");
  }

  // Unsupported hash, return as-is
  return password;
}

/**
 * Check if a stored password matches the provided password
 * Handles dynamic hash formats like {SHA256}base64hash
 */
function verifyPassword(
  storedPassword: string,
  providedPassword: string,
  hashAlgo?: string,
): boolean {
  // Check for dynamic hash format: {SCHEME}hash
  const schemeMatch = storedPassword.match(/^\{([^}]+)\}(.*)$/);

  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    const storedHash = schemeMatch[2];

    // Handle salted schemes (ssha, ssha256, ssha512)
    // Must match "ssha" prefix specifically, not just "s" (which would match sha256)
    if (scheme.startsWith("ssha")) {
      // Salted hash: decode base64, extract salt (last 8 bytes)
      const decoded = Buffer.from(storedHash, "base64");
      const hashLength = decoded.length - 8;
      const salt = decoded.subarray(hashLength);
      const expectedHash = decoded.subarray(0, hashLength);

      // Hash password with salt - remove "s" prefix to get algo (ssha -> sha, ssha256 -> sha256)
      const algo = scheme.substring(1);
      const hash = crypto
        .createHash(algo === "sha" ? "sha1" : algo)
        .update(providedPassword)
        .update(salt)
        .digest();

      return hash.equals(expectedHash);
    }

    // Non-salted schemes
    const algo = scheme === "sha" ? "sha1" : scheme;
    try {
      const hash = crypto.createHash(algo).update(providedPassword).digest();
      const storedHashBuf = Buffer.from(storedHash, "base64");
      return hash.equals(storedHashBuf);
    } catch {
      // Unknown algorithm
      return false;
    }
  }

  // Check for Unix crypt format: $type$salt$hash
  if (storedPassword.match(/^\$(1|5|6)\$/)) {
    // Unix crypt not supported in pure JS without native bindings
    // Would need node-crypt3 or similar
    return false;
  }

  // Static hash or plaintext
  if (hashAlgo) {
    const hashedProvided = hashPassword(providedPassword, hashAlgo);
    return storedPassword === hashedProvided;
  }

  // Plaintext comparison
  return storedPassword === providedPassword;
}

/**
 * DBI Authentication module
 */
export class DBIAuth {
  readonly name: string = "DBI";

  private conf!: LLNG_Conf;
  private dbiConfig!: DBIAuthConfig;
  private logger!: LLNG_Logger;
  private db!: PerlDBI_Client;
  private lastEntry: Record<string, any> | null = null;

  /**
   * Initialize the DBI auth module
   */
  async init(conf: LLNG_Conf, logger: LLNG_Logger): Promise<void> {
    this.conf = conf;
    this.logger = logger;
    this.dbiConfig = extractDBIAuthConfig(conf);

    // Validate required config
    if (!this.dbiConfig.dbiAuthChain) {
      throw new Error("DBI auth: dbiAuthChain is required");
    }
    if (!this.dbiConfig.dbiAuthTable) {
      throw new Error("DBI auth: dbiAuthTable is required");
    }
    if (!this.dbiConfig.dbiAuthLoginCol) {
      throw new Error("DBI auth: dbiAuthLoginCol is required");
    }
    if (!this.dbiConfig.dbiAuthPasswordCol) {
      throw new Error("DBI auth: dbiAuthPasswordCol is required");
    }

    try {
      this.db = PerlDBI({
        dbiChain: this.dbiConfig.dbiAuthChain,
        dbiUser: this.dbiConfig.dbiAuthUser,
        dbiPassword: this.dbiConfig.dbiAuthPassword,
      });

      logger.info(
        `DBI auth initialized, connected to ${this.dbiConfig.dbiAuthChain}`,
      );
    } catch (e: any) {
      logger.error(`DBI auth initialization failed: ${e.message}`);
      throw e;
    }
  }

  /**
   * Extract credentials from HTTP request
   */
  extractCredentials(req: Request): Credentials | null {
    const user =
      req.body?.user || req.body?.username || req.body?.login || null;
    const password = req.body?.password || req.body?.pwd || null;

    if (!user || !password) {
      return null;
    }

    return { user, password };
  }

  /**
   * Authenticate user against the database
   */
  async authenticate(credentials: Credentials): Promise<AuthResult> {
    const { user, password } = credentials;
    const { dbiAuthTable, dbiAuthLoginCol, dbiAuthPasswordCol } =
      this.dbiConfig;

    try {
      // Query user from database
      const rows = await this.db(dbiAuthTable)
        .select("*")
        .where(dbiAuthLoginCol, user)
        .limit(1);

      if (!rows || rows.length === 0) {
        this.logger.debug(`DBI auth: User ${user} not found`);
        this.lastEntry = null;
        return {
          success: false,
          error: "User not found",
          errorCode: "PE_BADCREDENTIALS",
        };
      }

      const entry = rows[0];
      const storedPassword = entry[dbiAuthPasswordCol];

      if (!storedPassword) {
        this.logger.warn(`DBI auth: No password found for user ${user}`);
        this.lastEntry = null;
        return {
          success: false,
          error: "Invalid credentials",
          errorCode: "PE_BADCREDENTIALS",
        };
      }

      // Verify password
      const dynamicHash = this.dbiConfig.dbiDynamicHashEnabled;
      const hashAlgo = dynamicHash
        ? undefined
        : this.dbiConfig.dbiAuthPasswordHash;

      if (!verifyPassword(storedPassword, password, hashAlgo)) {
        this.logger.debug(`DBI auth: Bad password for user ${user}`);
        this.lastEntry = null;
        return {
          success: false,
          error: "Invalid credentials",
          errorCode: "PE_BADCREDENTIALS",
        };
      }

      // Authentication successful
      this.lastEntry = entry;
      this.logger.info(`DBI auth: User ${user} authenticated successfully`);

      return { success: true };
    } catch (e: any) {
      this.logger.error(`DBI auth error: ${e.message}`);
      this.lastEntry = null;
      return {
        success: false,
        error: "Database error",
        errorCode: "PE_ERROR",
      };
    }
  }

  /**
   * Get the last authenticated entry (user row from database)
   */
  getLastEntry(): Record<string, any> | null {
    return this.lastEntry;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.destroy();
      this.logger.debug("DBI auth connection closed");
    }
  }
}

/**
 * Factory function to create DBI auth module
 */
export function createDBIAuth(): DBIAuth {
  return new DBIAuth();
}

export default DBIAuth;
