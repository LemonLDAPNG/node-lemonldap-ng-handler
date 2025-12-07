/**
 * DBI (SQL) Password module for LemonLDAP::NG
 *
 * Provides password change functionality for SQL databases.
 * Uses the perl-dbi package for database connectivity via Knex.js.
 */

import type { LLNG_Conf, LLNG_Logger } from "@lemonldap-ng/types";
import PerlDBI, { type PerlDBI_Client } from "perl-dbi";
import crypto from "crypto";

/**
 * Password change result
 */
export interface PasswordChangeResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  message?: string;
}

/**
 * Password change options
 */
export interface PasswordChangeOptions {
  /** Old password for verification */
  oldPassword?: string;
  /** Skip old password verification (for admin reset) */
  passwordReset?: boolean;
  /** Set force reset flag after change */
  forceReset?: boolean;
  /** Use email instead of username as identifier */
  useMail?: boolean;
}

/**
 * Password module interface
 */
export interface PasswordModule {
  readonly name: string;
  init(conf: LLNG_Conf, logger: LLNG_Logger): Promise<void>;
  confirm(userId: string, password: string): Promise<boolean>;
  modifyPassword(
    userId: string,
    newPassword: string,
    options?: PasswordChangeOptions,
  ): Promise<PasswordChangeResult>;
  close?(): Promise<void>;
}

/**
 * DBI Password configuration
 */
export interface DBIPasswordConfig {
  dbiAuthChain: string;
  dbiAuthUser?: string;
  dbiAuthPassword?: string;
  dbiAuthTable: string;
  dbiAuthLoginCol: string;
  dbiAuthPasswordCol: string;
  dbiMailCol?: string;
  dbiAuthPasswordHash?: string;
  dbiDynamicHashEnabled?: boolean;
  dbiDynamicHashNewPasswordScheme?: string;
  dbiDynamicHashValidSchemes?: string;
  dbiDynamicHashValidSaltedSchemes?: string;
  portalRequireOldPassword?: boolean | string | number;
}

/**
 * Extract DBI Password configuration from LLNG_Conf
 */
export function extractDBIPasswordConfig(conf: LLNG_Conf): DBIPasswordConfig {
  return {
    dbiAuthChain: conf.dbiAuthChain as string,
    dbiAuthUser: conf.dbiAuthUser as string | undefined,
    dbiAuthPassword: conf.dbiAuthPassword as string | undefined,
    dbiAuthTable: (conf.dbiAuthTable || conf.dbiUserTable) as string,
    dbiAuthLoginCol: (conf.dbiAuthLoginCol ||
      conf.userPivot ||
      "user") as string,
    dbiAuthPasswordCol: (conf.dbiAuthPasswordCol || "password") as string,
    dbiMailCol: (conf.dbiMailCol || conf.dbiUserMailCol) as string | undefined,
    dbiAuthPasswordHash: conf.dbiAuthPasswordHash as string | undefined,
    dbiDynamicHashEnabled: conf.dbiDynamicHashEnabled as boolean | undefined,
    dbiDynamicHashNewPasswordScheme: conf.dbiDynamicHashNewPasswordScheme as
      | string
      | undefined,
    dbiDynamicHashValidSchemes: (conf.dbiDynamicHashValidSchemes ||
      "SHA SHA256 SHA512") as string,
    dbiDynamicHashValidSaltedSchemes: (conf.dbiDynamicHashValidSaltedSchemes ||
      "SSHA SSHA256 SSHA512") as string,
    portalRequireOldPassword: conf.portalRequireOldPassword as
      | boolean
      | string
      | number
      | undefined,
  };
}

/**
 * Hash password using specified algorithm (hex output)
 */
function hashPasswordHex(password: string, algo: string): string {
  const normalizedAlgo = algo.toLowerCase();
  if (["sha", "sha1"].includes(normalizedAlgo)) {
    return crypto.createHash("sha1").update(password).digest("hex");
  }
  if (normalizedAlgo === "sha256") {
    return crypto.createHash("sha256").update(password).digest("hex");
  }
  if (normalizedAlgo === "sha512") {
    return crypto.createHash("sha512").update(password).digest("hex");
  }
  if (normalizedAlgo === "md5") {
    return crypto.createHash("md5").update(password).digest("hex");
  }
  return password;
}

/**
 * Hash password using specified algorithm (base64 output for dynamic hash)
 */
function hashPasswordBase64(password: string, algo: string): string {
  const normalizedAlgo = algo.toLowerCase();
  if (["sha", "sha1"].includes(normalizedAlgo)) {
    return crypto.createHash("sha1").update(password).digest("base64");
  }
  if (normalizedAlgo === "sha256") {
    return crypto.createHash("sha256").update(password).digest("base64");
  }
  if (normalizedAlgo === "sha512") {
    return crypto.createHash("sha512").update(password).digest("base64");
  }
  if (normalizedAlgo === "md5") {
    return crypto.createHash("md5").update(password).digest("base64");
  }
  return password;
}

/**
 * Hash password with salt (for salted schemes like SSHA)
 */
function hashPasswordSalted(
  password: string,
  algo: string,
  salt: Buffer,
): string {
  const normalizedAlgo = algo.toLowerCase();
  let hash: Buffer;

  if (["sha", "sha1"].includes(normalizedAlgo)) {
    hash = crypto.createHash("sha1").update(password).update(salt).digest();
  } else if (normalizedAlgo === "sha256") {
    hash = crypto.createHash("sha256").update(password).update(salt).digest();
  } else if (normalizedAlgo === "sha512") {
    hash = crypto.createHash("sha512").update(password).update(salt).digest();
  } else if (normalizedAlgo === "md5") {
    hash = crypto.createHash("md5").update(password).update(salt).digest();
  } else {
    return password;
  }

  // Return base64(hash + salt)
  return Buffer.concat([hash, salt]).toString("base64");
}

/**
 * Generate random salt (8 bytes)
 */
function generateSalt(): Buffer {
  return crypto.randomBytes(8);
}

/**
 * Verify password against stored hash
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
      const decoded = Buffer.from(storedHash, "base64");
      const hashLength = decoded.length - 8;
      const salt = decoded.subarray(hashLength);
      const expectedHash = decoded.subarray(0, hashLength);

      const algo = scheme.substring(1); // Remove 's' prefix to get sha, sha256, sha512
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
      return false;
    }
  }

  // Static hash or plaintext
  if (hashAlgo) {
    const hashedProvided = hashPasswordHex(providedPassword, hashAlgo);
    return storedPassword === hashedProvided;
  }

  // Plaintext comparison
  return storedPassword === providedPassword;
}

/**
 * DBI Password module
 */
export class DBIPassword implements PasswordModule {
  readonly name: string = "DBI";

  private conf!: LLNG_Conf;
  private dbiConfig!: DBIPasswordConfig;
  private logger!: LLNG_Logger;
  private db!: PerlDBI_Client;

  /**
   * Initialize the DBI password module
   */
  async init(conf: LLNG_Conf, logger: LLNG_Logger): Promise<void> {
    this.conf = conf;
    this.logger = logger;
    this.dbiConfig = extractDBIPasswordConfig(conf);

    // Validate required config
    if (!this.dbiConfig.dbiAuthChain) {
      throw new Error("DBI Password: dbiAuthChain is required");
    }
    if (!this.dbiConfig.dbiAuthTable) {
      throw new Error("DBI Password: dbiAuthTable is required");
    }
    if (!this.dbiConfig.dbiAuthLoginCol) {
      throw new Error("DBI Password: dbiAuthLoginCol is required");
    }
    if (!this.dbiConfig.dbiAuthPasswordCol) {
      throw new Error("DBI Password: dbiAuthPasswordCol is required");
    }

    try {
      this.db = PerlDBI({
        dbiChain: this.dbiConfig.dbiAuthChain,
        dbiUser: this.dbiConfig.dbiAuthUser,
        dbiPassword: this.dbiConfig.dbiAuthPassword,
      });

      logger.info("DBI Password module initialized");
    } catch (e: any) {
      logger.error(`DBI Password initialization failed: ${e.message}`);
      throw e;
    }
  }

  /**
   * Verify current password is correct
   */
  async confirm(userId: string, password: string): Promise<boolean> {
    const { dbiAuthTable, dbiAuthLoginCol, dbiAuthPasswordCol } =
      this.dbiConfig;

    try {
      const rows = await this.db(dbiAuthTable)
        .select(dbiAuthPasswordCol)
        .where(dbiAuthLoginCol, userId)
        .limit(1);

      if (!rows || rows.length === 0) {
        this.logger.debug(`DBI Password: User ${userId} not found`);
        return false;
      }

      const storedPassword = rows[0][dbiAuthPasswordCol];
      if (!storedPassword) {
        return false;
      }

      const dynamicHash = this.dbiConfig.dbiDynamicHashEnabled;
      const hashAlgo = dynamicHash
        ? undefined
        : this.dbiConfig.dbiAuthPasswordHash;

      return verifyPassword(storedPassword, password, hashAlgo);
    } catch (e: any) {
      this.logger.error(`DBI Password confirm error: ${e.message}`);
      return false;
    }
  }

  /**
   * Change user password
   */
  async modifyPassword(
    userId: string,
    newPassword: string,
    options?: PasswordChangeOptions,
  ): Promise<PasswordChangeResult> {
    const opts = options || {};
    const {
      dbiAuthTable,
      dbiAuthLoginCol,
      dbiAuthPasswordCol,
      dbiMailCol,
      dbiDynamicHashEnabled,
      dbiDynamicHashNewPasswordScheme,
      dbiAuthPasswordHash,
    } = this.dbiConfig;

    // Check if old password is required
    const requireOldPassword =
      !opts.passwordReset && this.shouldRequireOldPassword();

    if (requireOldPassword && !opts.oldPassword) {
      return {
        success: false,
        error: "Old password is required",
        errorCode: "PE_PP_MUST_SUPPLY_OLD_PASSWORD",
      };
    }

    // Verify old password if required
    if (requireOldPassword && opts.oldPassword) {
      const valid = await this.confirm(userId, opts.oldPassword);
      if (!valid) {
        this.logger.debug(
          `DBI Password: old password verification failed for ${userId}`,
        );
        return {
          success: false,
          error: "Current password is incorrect",
          errorCode: "PE_BADOLDPASSWORD",
        };
      }
    }

    // Determine which column to use for lookup
    const lookupCol = opts.useMail && dbiMailCol ? dbiMailCol : dbiAuthLoginCol;

    try {
      // Hash the new password
      let hashedPassword: string;

      if (dbiDynamicHashEnabled) {
        hashedPassword = this.hashNewPassword(
          newPassword,
          dbiDynamicHashNewPasswordScheme,
        );
      } else if (dbiAuthPasswordHash) {
        hashedPassword = hashPasswordHex(newPassword, dbiAuthPasswordHash);
      } else {
        hashedPassword = newPassword;
      }

      // Update password in database
      const updated = await this.db(dbiAuthTable)
        .where(lookupCol, userId)
        .update({ [dbiAuthPasswordCol]: hashedPassword });

      if (updated === 0) {
        this.logger.warn(
          `DBI Password: User ${userId} not found for password update`,
        );
        return {
          success: false,
          error: "User not found",
          errorCode: "PE_USERNOTFOUND",
        };
      }

      this.logger.info(
        `DBI Password: Password changed successfully for ${userId}`,
      );
      return {
        success: true,
        message: "Password changed successfully",
      };
    } catch (e: any) {
      this.logger.error(`DBI Password modification error: ${e.message}`);
      return {
        success: false,
        error: "Database error",
        errorCode: "PE_ERROR",
      };
    }
  }

  /**
   * Hash new password using configured scheme
   */
  private hashNewPassword(password: string, scheme?: string): string {
    if (!scheme || scheme === "") {
      return password;
    }

    const upperScheme = scheme.toUpperCase();
    const validSchemes = (
      this.dbiConfig.dbiDynamicHashValidSchemes || "SHA SHA256 SHA512"
    )
      .toUpperCase()
      .split(" ");
    const validSaltedSchemes = (
      this.dbiConfig.dbiDynamicHashValidSaltedSchemes || "SSHA SSHA256 SSHA512"
    )
      .toUpperCase()
      .split(" ");

    // Salted hash scheme
    if (validSaltedSchemes.includes(upperScheme)) {
      const algo = upperScheme.substring(1); // Remove 'S' prefix
      const salt = generateSalt();
      const hash = hashPasswordSalted(password, algo, salt);
      return `{${upperScheme}}${hash}`;
    }

    // Non-salted hash scheme
    if (validSchemes.includes(upperScheme)) {
      const hash = hashPasswordBase64(password, upperScheme);
      return `{${upperScheme}}${hash}`;
    }

    // Unknown scheme - return plaintext
    this.logger.warn(
      `DBI Password: Unknown hash scheme ${scheme}, using plaintext`,
    );
    return password;
  }

  /**
   * Determine if old password should be required
   */
  private shouldRequireOldPassword(): boolean {
    const rule = this.dbiConfig.portalRequireOldPassword;

    if (rule === true || rule === "1" || rule === 1) {
      return true;
    }
    if (rule === false || rule === "0" || rule === 0 || rule === undefined) {
      return false;
    }

    // Default to true for safety
    return true;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.destroy();
      this.logger.debug("DBI Password connection closed");
    }
  }
}

/**
 * Factory function to create DBI Password module
 */
export function createDBIPassword(): DBIPassword {
  return new DBIPassword();
}

/**
 * Factory function matching portal's expected signature
 */
export function createPasswordModule(): PasswordModule {
  return new DBIPassword();
}

export default DBIPassword;
