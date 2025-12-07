/**
 * SAML IdP (Issuer) Types
 *
 * Configuration interfaces compatible with LemonLDAP::NG Perl configuration.
 */

import type {
  Logger,
  SAMLServiceConfig,
  SAMLSPMetaDataOptions,
  SAMLAttributeExport,
  SAMLSessionData,
} from "@lemonldap-ng/lib-saml";

// Re-export types from lib-saml
export type {
  Logger,
  SAMLServiceConfig,
  SAMLSPMetaDataOptions,
  SAMLAttributeExport,
  SAMLSessionData,
  SAMLBinding,
  SAMLEncryptionMode,
  SAMLNameIDFormatType,
  SAMLSignatureMethod,
} from "@lemonldap-ng/lib-saml";

/**
 * SAML IdP Configuration
 * This is the main configuration interface for the SAML Issuer
 */
export interface SAMLIssuerConfig extends SAMLServiceConfig {
  /** Portal URL */
  portal: string;

  /** Logger instance */
  logger?: Logger;

  /** Base path for SAML routes (default: /saml) */
  basePath?: string;

  /** Registered SPs by config key - options */
  samlSPMetaDataOptions?: Record<string, SAMLSPMetaDataOptions>;

  /** Registered SPs by config key - metadata XML */
  samlSPMetaDataXML?: Record<string, string>;

  /** Registered SPs by config key - exported attributes */
  samlSPMetaDataExportedAttributes?: Record<string, SAMLAttributeExport[]>;

  /** Timeout for SSO session (seconds) */
  samlSSOSessionTimeout?: number;

  /** Allow unsolicited SSO */
  samlIdPAllowUnsolicitedSSO?: boolean;

  /**
   * Callback to get user session data
   * Used by SSO handler to get user attributes
   */
  getSession?: (sessionId: string) => Promise<Record<string, unknown> | null>;

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

  /**
   * Callback to delete SAML session data
   */
  deleteSAMLSession?: (sessionId: string) => Promise<void>;

  /**
   * Callback to store federation identity
   */
  storeIdentity?: (
    userId: string,
    spEntityId: string,
    dump: string,
  ) => Promise<void>;

  /**
   * Callback to get federation identity
   */
  getIdentity?: (userId: string, spEntityId: string) => Promise<string | null>;
}

/**
 * SSO Context - data passed through SSO flow
 */
export interface SSOContext {
  /** Remote SP entity ID */
  spEntityId: string;
  /** SP config key */
  spConfKey: string;
  /** SP options */
  spOptions: SAMLSPMetaDataOptions;
  /** Request ID (for InResponseTo) */
  requestId?: string;
  /** RelayState */
  relayState?: string;
  /** Requested NameID format */
  requestedNameIdFormat?: string;
  /** Force authentication requested */
  forceAuthn?: boolean;
  /** Is passive requested */
  isPassive?: boolean;
  /** Assertion consumer service URL */
  acsUrl?: string;
  /** HTTP method used */
  httpMethod?: string;
}

/**
 * SLO Context - data passed through SLO flow
 */
export interface SLOContext {
  /** Remote provider entity ID */
  providerEntityId: string;
  /** Provider config key */
  providerConfKey: string;
  /** Is this a request (true) or response (false) */
  isRequest: boolean;
  /** Request ID (for InResponseTo) */
  requestId?: string;
  /** RelayState */
  relayState?: string;
  /** NameID */
  nameId?: string;
  /** NameID format */
  nameIdFormat?: string;
  /** Session index */
  sessionIndex?: string;
  /** HTTP method used */
  httpMethod?: string;
}

/**
 * SAML Response to send
 */
export interface SAMLResponse {
  /** Target URL */
  url: string;
  /** HTTP method (GET for redirect, POST for form) */
  method: "GET" | "POST";
  /** Form data for POST binding */
  formData?: {
    SAMLResponse?: string;
    SAMLRequest?: string;
    RelayState?: string;
  };
  /** Response body (for SOAP) */
  body?: string;
  /** Content type */
  contentType?: string;
}

/**
 * Artifact resolution result
 */
export interface ArtifactResult {
  /** Success */
  success: boolean;
  /** Resolved artifact data */
  data?: string;
  /** Error message */
  error?: string;
}
