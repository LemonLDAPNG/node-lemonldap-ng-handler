import type { LLNG_Conf } from "@lemonldap-ng/types";

/**
 * LDAP configuration options extracted from LLNG_Conf
 */
export interface LDAPConfig {
  // Connection
  ldapServer: string; // URL(s) LDAP, e.g., "ldap://localhost:389"
  ldapPort?: number; // Port (optional if in URL)
  ldapVersion?: number; // LDAP version (default: 3)
  ldapTimeout?: number; // Connection timeout (ms)

  // TLS
  ldapVerify?: string; // "none" | "optional" | "required"
  ldapCAFile?: string; // CA certificate path
  ldapCAPath?: string; // CA certificates directory

  // Service account authentication
  managerDn?: string; // Service account DN
  managerPassword?: string; // Service account password

  // User search
  ldapBase: string; // Base DN for search
  AuthLDAPFilter?: string; // Filter (default: "(&(uid=$user)(objectClass=inetOrgPerson))")
  LDAPFilter?: string; // Alias for AuthLDAPFilter
  ldapSearchDeref?: string; // "never" | "search" | "find" | "always"

  // Attributes
  ldapExportedVars?: Record<string, string>; // session_key => ldap_attr
  exportedVars?: Record<string, string>; // Generic exported vars

  // Password Policy (RFC 3876)
  ldapPpolicyControl?: boolean; // Enable ppolicy control
  ldapSetPassword?: boolean; // Use SetPassword extended op
  ldapChangePasswordAsUser?: boolean;
  ldapAllowResetExpiredPassword?: boolean; // Allow resetting expired passwords
  ldapForcePasswordChangeExpirationWarning?: number; // Seconds - force change if expires sooner

  // Groups
  ldapGroupBase?: string; // Groups base DN
  ldapGroupObjectClass?: string; // Group objectClass (default: groupOfNames)
  ldapGroupAttributeName?: string; // Member attribute (default: member)
  ldapGroupAttributeNameUser?: string; // User attr to search (default: dn)
  ldapGroupAttributeNameSearch?: string; // Attrs to retrieve
  ldapGroupAttributeNameGroup?: string; // For recursive search
  ldapGroupRecursive?: boolean; // Recursive group search
  ldapGroupDecodeSearchedValue?: boolean; // UTF-8 decode

  // Options
  multiValuesSeparator?: string; // Multi-value separator (default: ";")
  ldapPwdEnc?: string; // Password encoding (default: "utf-8")

  // Password reset attribute (for force reset after change)
  ldapUsePasswordResetAttribute?: boolean;
  ldapPasswordResetAttribute?: string; // default: "pwdReset"
  ldapPasswordResetAttributeValue?: string; // default: "TRUE"
}

/**
 * LDAP search options
 */
export interface LDAPSearchOptions {
  base?: string;
  scope?: "base" | "one" | "sub";
  filter: string;
  attributes?: string[];
  deref?: "never" | "search" | "find" | "always";
  sizeLimit?: number;
  timeLimit?: number;
}

/**
 * LDAP bind result
 */
export interface LDAPBindResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  ppolicyError?: number;
  ppolicyGrace?: number;
  ppolicyExpire?: number;
}

/**
 * LDAP entry from search
 */
export interface LDAPEntry {
  dn: string;
  [attribute: string]: string | string[];
}

/**
 * Group data from LDAP search
 */
export interface LDAPGroupData {
  name: string;
  dn: string;
  [attribute: string]: string | string[];
}

/**
 * Password modification result
 */
export interface PasswordModifyResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  ppolicyError?: number;
}

/**
 * Options for password modification
 */
export interface PasswordModifyOptions {
  /** Use SetPassword extended operation (RFC 3062) */
  useSetPassword?: boolean;
  /** Bind as user to change password */
  changeAsUser?: boolean;
  /** Require old password verification */
  requireOldPassword?: boolean;
  /** Use password policy control */
  ppolicyControl?: boolean;
  /** Active Directory mode (use unicodePwd with UTF-16LE) */
  isAD?: boolean;
  /** Set password reset attribute after change (force change at next login) */
  forceReset?: boolean;
}

/**
 * Extract LDAP config from LLNG_Conf
 */
export function extractLDAPConfig(conf: LLNG_Conf): LDAPConfig {
  return {
    ldapServer: (conf.ldapServer as string) || "ldap://localhost:389",
    ldapPort: conf.ldapPort as number | undefined,
    ldapVersion: (conf.ldapVersion as number) || 3,
    ldapTimeout: conf.ldapTimeout as number | undefined,
    ldapVerify: conf.ldapVerify as string | undefined,
    ldapCAFile: conf.ldapCAFile as string | undefined,
    ldapCAPath: conf.ldapCAPath as string | undefined,
    managerDn: conf.managerDn as string | undefined,
    managerPassword: conf.managerPassword as string | undefined,
    ldapBase: (conf.ldapBase as string) || "",
    AuthLDAPFilter: conf.AuthLDAPFilter as string | undefined,
    LDAPFilter: conf.LDAPFilter as string | undefined,
    ldapSearchDeref: conf.ldapSearchDeref as string | undefined,
    ldapExportedVars: conf.ldapExportedVars as
      | Record<string, string>
      | undefined,
    exportedVars: conf.exportedVars as Record<string, string> | undefined,
    ldapPpolicyControl: conf.ldapPpolicyControl as boolean | undefined,
    ldapSetPassword: conf.ldapSetPassword as boolean | undefined,
    ldapChangePasswordAsUser: conf.ldapChangePasswordAsUser as
      | boolean
      | undefined,
    ldapGroupBase: conf.ldapGroupBase as string | undefined,
    ldapGroupObjectClass: conf.ldapGroupObjectClass as string | undefined,
    ldapGroupAttributeName: conf.ldapGroupAttributeName as string | undefined,
    ldapGroupAttributeNameUser: conf.ldapGroupAttributeNameUser as
      | string
      | undefined,
    ldapGroupAttributeNameSearch: conf.ldapGroupAttributeNameSearch as
      | string
      | undefined,
    ldapGroupAttributeNameGroup: conf.ldapGroupAttributeNameGroup as
      | string
      | undefined,
    ldapGroupRecursive: conf.ldapGroupRecursive as boolean | undefined,
    ldapGroupDecodeSearchedValue: conf.ldapGroupDecodeSearchedValue as
      | boolean
      | undefined,
    multiValuesSeparator: (conf.multiValuesSeparator as string) || ";",
    ldapPwdEnc: (conf.ldapPwdEnc as string) || "utf-8",
    ldapUsePasswordResetAttribute: conf.ldapUsePasswordResetAttribute as
      | boolean
      | undefined,
    ldapPasswordResetAttribute:
      (conf.ldapPasswordResetAttribute as string) || "pwdReset",
    ldapPasswordResetAttributeValue:
      (conf.ldapPasswordResetAttributeValue as string) || "TRUE",
    ldapAllowResetExpiredPassword: conf.ldapAllowResetExpiredPassword as
      | boolean
      | undefined,
  };
}
