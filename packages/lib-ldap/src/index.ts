/**
 * LDAP library for LemonLDAP::NG
 *
 * Provides shared LDAP connection and utilities for auth-ldap, userdb-ldap,
 * password-ldap, and other LDAP-based modules.
 */

export { LDAPConnection } from "./ldap-connection";

export {
  type LDAPConfig,
  type LDAPSearchOptions,
  type LDAPBindResult,
  type LDAPEntry,
  type LDAPGroupData,
  type PasswordModifyResult,
  type PasswordModifyOptions,
  extractLDAPConfig,
} from "./types";

export {
  escapeFilterValue,
  escapeDnValue,
  buildFilter,
  parseLDAPUrl,
  parseLDAPUrls,
  getLdapValue,
  getLdapValues,
  convertDerefOption,
  PPOLICY_ERRORS,
  mapPpolicyError,
  type ParsedLDAPUrl,
} from "./ldap-utils";
