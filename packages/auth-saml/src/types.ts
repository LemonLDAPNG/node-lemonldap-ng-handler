/**
 * SAML SP Authentication Types
 *
 * Configuration interfaces compatible with LemonLDAP::NG Perl configuration.
 */

import type {
  Logger,
  SAMLServiceConfig,
  SAMLIdPMetaDataOptions,
  SAMLSessionData,
} from "@lemonldap-ng/lib-saml";

// Re-export types from lib-saml
export type {
  Logger,
  SAMLServiceConfig,
  SAMLIdPMetaDataOptions,
  SAMLSessionData,
  SAMLAuthResult,
  SAMLRedirectResponse,
  SAMLBinding,
  SAMLEncryptionMode,
  SAMLNameIDFormatType,
  SAMLSignatureMethod,
} from "@lemonldap-ng/lib-saml";

/**
 * SAML SP Authentication Configuration
 */
export interface SAMLAuthConfig extends SAMLServiceConfig {
  /** Portal URL */
  portal: string;

  /** Logger instance */
  logger?: Logger;

  /** Registered IdPs by config key - options */
  samlIdPMetaDataOptions?: Record<string, SAMLIdPMetaDataOptions>;

  /** Registered IdPs by config key - metadata XML */
  samlIdPMetaDataXML?: Record<string, string>;

  /** Registered IdPs by config key - exported attributes */
  samlIdPMetaDataExportedAttributes?: Record<string, Record<string, string>>;

  /** Default IdP to use (config key) */
  samlIdPDefault?: string;

  /** Allow IDP choice */
  samlIdPList?: string[];

  /** Timeout for SAML auth state (seconds) */
  samlRelayStateTimeout?: number;

  /**
   * Callback to store authentication state
   */
  storeAuthState?: (state: string, data: SAMLAuthState) => Promise<void>;

  /**
   * Callback to retrieve and consume authentication state
   */
  consumeAuthState?: (state: string) => Promise<SAMLAuthState | null>;

  /**
   * Callback to store SAML session data
   */
  storeSAMLSession?: (
    sessionId: string,
    data: SAMLSessionData,
  ) => Promise<void>;

  /**
   * Callback to get SAML session data
   */
  getSAMLSession?: (sessionId: string) => Promise<SAMLSessionData | null>;
}

/**
 * SAML Authentication State
 * Stored during authentication flow
 */
export interface SAMLAuthState {
  /** IdP config key */
  idpConfKey: string;
  /** IdP entity ID */
  idpEntityId: string;
  /** Original URL to return to */
  returnUrl?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp */
  expiresAt: number;
}

/**
 * SAML Credentials extracted from request
 */
export interface SAMLCredentials {
  /** SAML Response from IdP */
  samlResponse: string;
  /** RelayState */
  relayState?: string;
  /** HTTP method used */
  httpMethod: string;
}
