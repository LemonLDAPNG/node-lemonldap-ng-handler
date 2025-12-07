/**
 * SAML User Database Types
 */

import type { Logger, SAMLIdPMetaDataOptions } from "@lemonldap-ng/lib-saml";

// Re-export types from lib-saml
export type { Logger, SAMLIdPMetaDataOptions } from "@lemonldap-ng/lib-saml";

/**
 * SAML User Database Configuration
 */
export interface SAMLUserDBConfig {
  /** Logger instance */
  logger?: Logger;

  /** Registered IdPs by config key - options */
  samlIdPMetaDataOptions?: Record<string, SAMLIdPMetaDataOptions>;

  /** Registered IdPs by config key - exported attributes mapping */
  samlIdPMetaDataExportedAttributes?: Record<string, Record<string, string>>;
}

/**
 * User information from SAML
 */
export interface SAMLUserInfo {
  /** User identifier */
  userId: string;
  /** User attributes */
  attributes: Record<string, unknown>;
}
