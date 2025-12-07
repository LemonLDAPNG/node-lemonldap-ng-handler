/**
 * DBI (SQL) UserDB module for LemonLDAP::NG
 *
 * Retrieves user attributes from SQL databases (SQLite, PostgreSQL, MySQL, Oracle).
 * Uses the perl-dbi package for database connectivity via Knex.js.
 */

import type { LLNG_Conf, LLNG_Logger, LLNG_Session } from "@lemonldap-ng/types";
import PerlDBI, { type PerlDBI_Client } from "perl-dbi";

/**
 * User data from UserDB
 */
export interface UserData {
  uid: string;
  attributes: Record<string, string | string[]>;
  groups?: string[];
}

/**
 * UserDB module interface
 */
export interface UserDBModule {
  readonly name: string;
  init(_conf: LLNG_Conf, _logger: LLNG_Logger): Promise<void>;
  getUser(_username: string): Promise<UserData | null>;
  setSessionInfo(_session: LLNG_Session, _user: UserData): void;
  close?(): Promise<void>;
}

/**
 * DBI UserDB configuration extracted from LLNG_Conf
 */
export interface DBIUserDBConfig {
  dbiUserChain: string;
  dbiUserUser?: string;
  dbiUserPassword?: string;
  dbiUserTable: string;
  dbiUserLoginCol: string;
  dbiUserMailCol?: string;
  userPivot?: string;
  exportedVars?: Record<string, string>;
  dbiExportedVars?: Record<string, string>;
  multiValuesSeparator?: string;
}

/**
 * Extract DBI UserDB configuration from LLNG_Conf
 */
export function extractDBIUserDBConfig(conf: LLNG_Conf): DBIUserDBConfig {
  return {
    dbiUserChain: (conf.dbiUserChain || conf.dbiAuthChain) as string,
    dbiUserUser: (conf.dbiUserUser || conf.dbiAuthUser) as string | undefined,
    dbiUserPassword: (conf.dbiUserPassword || conf.dbiAuthPassword) as
      | string
      | undefined,
    dbiUserTable: (conf.dbiUserTable || conf.dbiAuthTable) as string,
    dbiUserLoginCol: (conf.dbiUserLoginCol ||
      conf.dbiAuthLoginCol ||
      conf.userPivot ||
      "user") as string,
    dbiUserMailCol: conf.dbiUserMailCol as string | undefined,
    userPivot: conf.userPivot as string | undefined,
    exportedVars: conf.exportedVars as Record<string, string> | undefined,
    dbiExportedVars: conf.dbiExportedVars as Record<string, string> | undefined,
    multiValuesSeparator: (conf.multiValuesSeparator || ";") as string,
  };
}

/**
 * DBI UserDB module
 */
export class DBIUserDB implements UserDBModule {
  readonly name: string = "DBI";

  private conf!: LLNG_Conf;
  private dbiConfig!: DBIUserDBConfig;
  private logger!: LLNG_Logger;
  private db!: PerlDBI_Client;
  private exportedVars: Record<string, string> = {};

  /**
   * Initialize the DBI UserDB module
   */
  async init(conf: LLNG_Conf, logger: LLNG_Logger): Promise<void> {
    this.conf = conf;
    this.logger = logger;
    this.dbiConfig = extractDBIUserDBConfig(conf);

    // Validate required config
    if (!this.dbiConfig.dbiUserChain) {
      throw new Error("DBI UserDB: dbiUserChain is required");
    }
    if (!this.dbiConfig.dbiUserTable) {
      throw new Error("DBI UserDB: dbiUserTable is required");
    }
    if (!this.dbiConfig.dbiUserLoginCol) {
      throw new Error("DBI UserDB: dbiUserLoginCol is required");
    }

    // Build exported vars mapping
    // dbiExportedVars takes precedence over general exportedVars
    this.exportedVars = {
      ...(this.dbiConfig.exportedVars || {}),
      ...(this.dbiConfig.dbiExportedVars || {}),
    };

    // Default mappings if not specified
    if (Object.keys(this.exportedVars).length === 0) {
      this.exportedVars = {
        uid: this.dbiConfig.dbiUserLoginCol,
        mail: this.dbiConfig.dbiUserMailCol || "mail",
      };
    }

    try {
      this.db = PerlDBI({
        dbiChain: this.dbiConfig.dbiUserChain,
        dbiUser: this.dbiConfig.dbiUserUser,
        dbiPassword: this.dbiConfig.dbiUserPassword,
      });

      logger.info(
        `DBI UserDB initialized with ${Object.keys(this.exportedVars).length} exported vars`,
      );
    } catch (e: any) {
      logger.error(`DBI UserDB initialization failed: ${e.message}`);
      throw e;
    }
  }

  /**
   * Get user data from database
   */
  async getUser(username: string): Promise<UserData | null> {
    const { dbiUserTable, dbiUserLoginCol } = this.dbiConfig;

    try {
      // Query user from database
      const rows = await this.db(dbiUserTable)
        .select("*")
        .where(dbiUserLoginCol, username)
        .limit(1);

      if (!rows || rows.length === 0) {
        this.logger.debug(`DBI UserDB: User ${username} not found`);
        return null;
      }

      const entry = rows[0];
      return this.buildUserData(entry, username);
    } catch (e: any) {
      this.logger.error(`DBI UserDB error: ${e.message}`);
      return null;
    }
  }

  /**
   * Get user data by email address
   */
  async getUserByMail(mail: string): Promise<UserData | null> {
    const { dbiUserTable, dbiUserMailCol } = this.dbiConfig;

    if (!dbiUserMailCol) {
      this.logger.warn("DBI UserDB: dbiUserMailCol not configured");
      return null;
    }

    try {
      const rows = await this.db(dbiUserTable)
        .select("*")
        .where(dbiUserMailCol, mail)
        .limit(1);

      if (!rows || rows.length === 0) {
        this.logger.debug(`DBI UserDB: User with mail ${mail} not found`);
        return null;
      }

      const entry = rows[0];
      const uid = entry[this.dbiConfig.dbiUserLoginCol];
      return this.buildUserData(entry, uid);
    } catch (e: any) {
      this.logger.error(`DBI UserDB error: ${e.message}`);
      return null;
    }
  }

  /**
   * Build UserData from database row
   */
  private buildUserData(
    entry: Record<string, any>,
    username: string,
  ): UserData {
    const attributes: Record<string, string | string[]> = {};

    // Map database columns to session keys using exportedVars
    for (const [sessionKey, dbColumn] of Object.entries(this.exportedVars)) {
      const value = entry[dbColumn];
      if (value !== undefined && value !== null) {
        attributes[sessionKey] = String(value);
      }
    }

    // Also include all columns as _dbi_* for reference
    for (const [key, value] of Object.entries(entry)) {
      if (value !== undefined && value !== null) {
        attributes[`_dbi_${key}`] = String(value);
      }
    }

    const uid =
      (attributes.uid as string) ||
      entry[this.dbiConfig.dbiUserLoginCol] ||
      username;

    this.logger.debug(
      `DBI UserDB: loaded ${Object.keys(attributes).length} attributes for "${username}"`,
    );

    return {
      uid,
      attributes,
    };
  }

  /**
   * Set session info from user data
   */
  setSessionInfo(session: LLNG_Session, user: UserData): void {
    // Set uid
    session.uid = user.uid;

    // Set _user if not already set
    if (!session._user) {
      session._user = user.uid;
    }

    // Copy all attributes to session
    for (const [key, value] of Object.entries(user.attributes)) {
      // Skip internal DBI attributes and session properties
      if (
        key.startsWith("_dbi_") ||
        key === "_session_id" ||
        key === "_utime"
      ) {
        continue;
      }
      (session as Record<string, unknown>)[key] = value;
    }

    this.logger.debug(`DBI UserDB: session info set for "${user.uid}"`);
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.destroy();
      this.logger.debug("DBI UserDB connection closed");
    }
  }
}

/**
 * Factory function to create DBI UserDB module
 */
export function createDBIUserDB(): DBIUserDB {
  return new DBIUserDB();
}

/**
 * Factory function matching portal's expected signature
 */
export function createUserDBModule(): UserDBModule {
  return new DBIUserDB();
}

export default DBIUserDB;
