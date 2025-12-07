/**
 * LDAP Password module for LemonLDAP::NG
 *
 * Provides password change functionality for LDAP directories.
 * Supports standard LDAP, SetPassword extended operation (RFC 3062),
 * and Active Directory.
 */

import type { LLNG_Conf, LLNG_Logger } from "@lemonldap-ng/types";
import {
  LDAPConnection,
  extractLDAPConfig,
  type LDAPConfig,
  type PasswordModifyResult,
} from "@lemonldap-ng/lib-ldap";

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
}

/**
 * Password module interface
 * To be implemented by password backend modules
 */
export interface PasswordModule {
  /** Module name */
  readonly name: string;

  /** Initialize module with configuration */
  init(conf: LLNG_Conf, logger: LLNG_Logger): Promise<void>;

  /**
   * Confirm/verify old password is correct
   */
  confirm(userDn: string, password: string): Promise<boolean>;

  /**
   * Change user password
   * @param userDn - User's DN (from session._dn)
   * @param newPassword - New password
   * @param options - Optional parameters
   */
  modifyPassword(
    userDn: string,
    newPassword: string,
    options?: PasswordChangeOptions,
  ): Promise<PasswordChangeResult>;

  /** Optional cleanup */
  close?(): Promise<void>;
}

/**
 * LDAP Password module
 * Implements password change for standard LDAP directories
 */
export class LDAPPassword implements PasswordModule {
  readonly name: string = "LDAP";

  protected conf!: LLNG_Conf;
  protected ldapConfig!: LDAPConfig;
  protected logger!: LLNG_Logger;
  protected ldapConnection!: LDAPConnection;

  async init(conf: LLNG_Conf, logger: LLNG_Logger): Promise<void> {
    this.conf = conf;
    this.logger = logger;
    this.ldapConfig = extractLDAPConfig(conf);

    // Use shared connection (same as auth-ldap/userdb-ldap)
    this.ldapConnection = LDAPConnection.getSharedConnection(
      this.ldapConfig,
      logger,
    );

    try {
      await this.ldapConnection.connect();
      this.logger.info("LDAP Password module initialized");
    } catch (e: any) {
      this.logger.warn(
        `LDAP Password module: initial connection failed: ${e.message}`,
      );
      // Don't fail init - will retry on first password change
    }
  }

  /**
   * Verify old password is correct
   */
  async confirm(userDn: string, password: string): Promise<boolean> {
    const result = await this.ldapConnection.userBind(userDn, password);
    return result.success;
  }

  /**
   * Change user password
   */
  async modifyPassword(
    userDn: string,
    newPassword: string,
    options?: PasswordChangeOptions,
  ): Promise<PasswordChangeResult> {
    const opts = options || {};

    // Validate connection
    if (!(await this.ldapConnection.validateConnection())) {
      return {
        success: false,
        error: "LDAP connection unavailable",
        errorCode: "PE_LDAPCONNECTFAILED",
      };
    }

    // Determine if old password is required
    const requireOldPassword =
      !opts.passwordReset && this.shouldRequireOldPassword();

    if (requireOldPassword && !opts.oldPassword) {
      return {
        success: false,
        error: "Old password is required",
        errorCode: "PE_PP_MUST_SUPPLY_OLD_PASSWORD",
      };
    }

    this.logger.debug(
      `Changing password for ${userDn} (requireOld=${requireOldPassword}, reset=${opts.passwordReset})`,
    );

    // Call lib-ldap's modifyPassword
    const result: PasswordModifyResult =
      await this.ldapConnection.modifyPassword(
        userDn,
        newPassword,
        opts.oldPassword,
        {
          useSetPassword: this.ldapConfig.ldapSetPassword,
          changeAsUser: this.ldapConfig.ldapChangePasswordAsUser,
          requireOldPassword,
          ppolicyControl: this.ldapConfig.ldapPpolicyControl,
        },
      );

    if (!result.success) {
      this.logger.warn(
        `Password change failed for ${userDn}: ${result.error} (${result.errorCode})`,
      );
      return {
        success: false,
        error: result.error,
        errorCode: result.errorCode,
      };
    }

    // Set force reset attribute if requested
    if (opts.forceReset) {
      await this.ldapConnection.setPasswordResetAttribute(userDn);
    }

    this.logger.info(`Password changed successfully for ${userDn}`);
    return {
      success: true,
      message: "Password changed successfully",
    };
  }

  /**
   * Determine if old password should be required based on configuration
   */
  protected shouldRequireOldPassword(): boolean {
    const rule = this.conf.portalRequireOldPassword;

    // Simple boolean or string check
    if (rule === true || rule === "1" || rule === 1) {
      return true;
    }
    if (rule === false || rule === "0" || rule === 0 || rule === undefined) {
      return false;
    }

    // For complex rules, default to true (safer)
    return true;
  }

  async close(): Promise<void> {
    // Shared connection - don't close it here
    this.logger.debug("LDAP Password module closed");
  }
}

/**
 * Active Directory Password module
 * Extends LDAPPassword with AD-specific handling
 */
export class ADPassword extends LDAPPassword {
  readonly name = "AD";

  /**
   * Change user password for Active Directory
   */
  async modifyPassword(
    userDn: string,
    newPassword: string,
    options?: PasswordChangeOptions,
  ): Promise<PasswordChangeResult> {
    const opts = options || {};

    // Validate connection
    if (!(await this.ldapConnection.validateConnection())) {
      return {
        success: false,
        error: "LDAP connection unavailable",
        errorCode: "PE_LDAPCONNECTFAILED",
      };
    }

    // Determine if old password is required
    const requireOldPassword =
      !opts.passwordReset && this.shouldRequireOldPassword();

    if (requireOldPassword && !opts.oldPassword) {
      return {
        success: false,
        error: "Old password is required",
        errorCode: "PE_PP_MUST_SUPPLY_OLD_PASSWORD",
      };
    }

    this.logger.debug(
      `Changing AD password for ${userDn} (requireOld=${requireOldPassword}, reset=${opts.passwordReset})`,
    );

    // Call lib-ldap's modifyPassword with AD mode
    const result: PasswordModifyResult =
      await this.ldapConnection.modifyPassword(
        userDn,
        newPassword,
        opts.oldPassword,
        {
          changeAsUser: this.ldapConfig.ldapChangePasswordAsUser,
          requireOldPassword,
          isAD: true,
        },
      );

    if (!result.success) {
      this.logger.warn(
        `AD password change failed for ${userDn}: ${result.error} (${result.errorCode})`,
      );
      return {
        success: false,
        error: result.error,
        errorCode: result.errorCode,
      };
    }

    // Set force reset in AD (pwdLastSet = 0)
    if (opts.forceReset) {
      await this.ldapConnection.setADForcePasswordChange(userDn);
    }

    this.logger.info(`AD password changed successfully for ${userDn}`);
    return {
      success: true,
      message: "Password changed successfully",
    };
  }
}

/**
 * Factory function to create LDAP password module
 */
export function createPasswordModule(): PasswordModule {
  return new LDAPPassword();
}

/**
 * Factory function to create AD password module
 */
export function createADPasswordModule(): PasswordModule {
  return new ADPassword();
}

export default LDAPPassword;
