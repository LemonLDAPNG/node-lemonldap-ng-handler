/**
 * SAML Library Types
 *
 * Types for SAML 2.0 IdP and SP configuration, compatible with
 * LemonLDAP::NG Perl implementation.
 */

/**
 * Re-export lasso.js types for convenience
 */
export {
  HttpMethod,
  SignatureMethod,
  NameIdFormat,
  AuthnContext,
  type NameIdFormatType,
  type AuthnContextType,
  type MessageResult,
  type ProviderInfo,
  type SamlAttribute,
  type ProviderOptions,
  type ServerOptions,
} from "lasso.js";

/**
 * SAML binding types (compatible with Perl config)
 */
export type SAMLBinding =
  | "http-post"
  | "http-redirect"
  | "http-soap"
  | "http-artifact";

/**
 * SAML encryption mode
 */
export type SAMLEncryptionMode = "none" | "nameid" | "assertion";

/**
 * SAML signature method
 */
export type SAMLSignatureMethod =
  | "RSA_SHA1"
  | "RSA_SHA256"
  | "RSA_SHA384"
  | "RSA_SHA512";

/**
 * SAML Name ID format types (compatible with Perl config values)
 */
export type SAMLNameIDFormatType =
  | "unspecified"
  | "email"
  | "x509"
  | "windows"
  | "kerberos"
  | "entity"
  | "persistent"
  | "transient"
  | "encrypted";

/**
 * Configuration for a remote IdP (used by SP)
 * Compatible with LemonLDAP::NG samlIdPMetaDataOptions
 */
export interface SAMLIdPMetaDataOptions {
  /** Entity ID of the IdP */
  samlIdPMetaDataOptionsEntityID?: string;
  /** Preferred SSO binding */
  samlIdPMetaDataOptionsSSOBinding?: SAMLBinding;
  /** Preferred SLO binding */
  samlIdPMetaDataOptionsSLOBinding?: SAMLBinding;
  /** Expected NameID format */
  samlIdPMetaDataOptionsNameIDFormat?: SAMLNameIDFormatType;
  /** Signature method to use */
  samlIdPMetaDataOptionsSignatureMethod?: SAMLSignatureMethod;
  /** Check signature on SSO messages */
  samlIdPMetaDataOptionsCheckSSOMessageSignature?: boolean;
  /** Check signature on SLO messages */
  samlIdPMetaDataOptionsCheckSLOMessageSignature?: boolean;
  /** Encryption mode for NameID */
  samlIdPMetaDataOptionsEncryptionMode?: SAMLEncryptionMode;
  /** Force UTF-8 encoding */
  samlIdPMetaDataOptionsForceUTF8?: boolean;
  /** Store SAML token in session */
  samlIdPMetaDataOptionsStoreSAMLToken?: boolean;
  /** User attribute to extract from assertion */
  samlIdPMetaDataOptionsUserAttribute?: string;
  /** Allow proxied authentication */
  samlIdPMetaDataOptionsAllowProxiedAuthn?: boolean;
  /** Requested authentication context */
  samlIdPMetaDataOptionsRequestedAuthnContext?: string;
  /** Force authentication */
  samlIdPMetaDataOptionsForceAuthn?: boolean;
  /** Is passive */
  samlIdPMetaDataOptionsIsPassive?: boolean;
  /** Allow login from this IdP */
  samlIdPMetaDataOptionsAllowLoginFromIDP?: boolean;
  /** RelayState URL */
  samlIdPMetaDataOptionsRelayStateURL?: string;
  /** Comment/display name */
  samlIdPMetaDataOptionsComment?: string;
  /** Display order */
  samlIdPMetaDataOptionsDisplayOrder?: number;
  /** Icon */
  samlIdPMetaDataOptionsIcon?: string;
  /** Tooltip */
  samlIdPMetaDataOptionsTooltip?: string;
  /** Resolution rule */
  samlIdPMetaDataOptionsResolutionRule?: string;
}

/**
 * Configuration for a remote SP (used by IdP)
 * Compatible with LemonLDAP::NG samlSPMetaDataOptions
 */
export interface SAMLSPMetaDataOptions {
  /** Entity ID of the SP */
  samlSPMetaDataOptionsEntityID?: string;
  /** NameID format to use */
  samlSPMetaDataOptionsNameIDFormat?: SAMLNameIDFormatType;
  /** Session key to use for NameID */
  samlSPMetaDataOptionsNameIDSessionKey?: string;
  /** One time use assertion */
  samlSPMetaDataOptionsOneTimeUse?: boolean;
  /** Session NotOnOrAfter timeout */
  samlSPMetaDataOptionsSessionNotOnOrAfterTimeout?: number;
  /** Assertion NotOnOrAfter timeout */
  samlSPMetaDataOptionsNotOnOrAfterTimeout?: number;
  /** Sign SSO message */
  samlSPMetaDataOptionsSignSSOMessage?: boolean;
  /** Sign SLO message */
  samlSPMetaDataOptionsSignSLOMessage?: boolean;
  /** Encryption mode */
  samlSPMetaDataOptionsEncryptionMode?: SAMLEncryptionMode;
  /** Check SSO message signature */
  samlSPMetaDataOptionsCheckSSOMessageSignature?: boolean;
  /** Check SLO message signature */
  samlSPMetaDataOptionsCheckSLOMessageSignature?: boolean;
  /** Enable IDPInitiatedSSO */
  samlSPMetaDataOptionsEnableIDPInitiatedURL?: boolean;
  /** Force UTF-8 encoding */
  samlSPMetaDataOptionsForceUTF8?: boolean;
  /** Authorization rule */
  samlSPMetaDataOptionsRule?: string;
  /** Comment/display name */
  samlSPMetaDataOptionsComment?: string;
}

/**
 * SAML attribute export configuration
 * Compatible with LemonLDAP::NG samlSPMetaDataExportedAttributes
 */
export interface SAMLAttributeExport {
  /** Attribute name in SAML assertion */
  name: string;
  /** Attribute name format */
  nameFormat?: string;
  /** Friendly name */
  friendlyName?: string;
  /** Session key to export */
  sessionKey: string;
  /** Required attribute */
  required?: boolean;
}

/**
 * SAML session data stored after authentication
 */
export interface SAMLSessionData {
  /** SAML assertion ID */
  _saml_id?: string;
  /** Stored SAML token (assertion XML) */
  _samlToken?: string;
  /** IdP entity ID */
  _idp?: string;
  /** IdP configuration key */
  _idpConfKey?: string;
  /** NameID format used */
  _samlNameIdFormat?: string;
  /** NameID value */
  _samlNameIdValue?: string;
  /** Session index from IdP */
  _samlSessionIndex?: string;
  /** Lasso Identity dump */
  _lassoIdentityDump?: string;
  /** Lasso Session dump */
  _lassoSessionDump?: string;
}

/**
 * Service configuration for SAML operations
 */
export interface SAMLServiceConfig {
  /** Entity ID for this service */
  samlEntityID: string;
  /** Organization name */
  samlOrganizationName?: string;
  /** Organization display name */
  samlOrganizationDisplayName?: string;
  /** Organization URL */
  samlOrganizationURL?: string;
  /** Metadata signing key (PEM) */
  samlServiceMetaDataPrivateKeySig?: string;
  /** Metadata signing certificate (PEM) */
  samlServiceMetaDataPublicKeySig?: string;
  /** Metadata signing key password */
  samlServiceMetaDataPrivateKeySigPwd?: string;
  /** Encryption key (PEM) */
  samlServiceMetaDataPrivateKeyEnc?: string;
  /** Encryption certificate (PEM) */
  samlServiceMetaDataPublicKeyEnc?: string;
  /** Encryption key password */
  samlServiceMetaDataPrivateKeyEncPwd?: string;
  /** Signature method */
  samlServiceSignatureMethod?: SAMLSignatureMethod;
  /** SSO bindings supported (as IdP) */
  samlSPSSODescriptorSingleSignOnServiceHTTPRedirect?: boolean;
  samlSPSSODescriptorSingleSignOnServiceHTTPPost?: boolean;
  samlSPSSODescriptorSingleSignOnServiceHTTPArtifact?: boolean;
  /** SLO bindings supported (as IdP) */
  samlSPSSODescriptorSingleLogoutServiceHTTPRedirect?: boolean;
  samlSPSSODescriptorSingleLogoutServiceHTTPPost?: boolean;
  samlSPSSODescriptorSingleLogoutServiceSOAP?: boolean;
  /** Artifact resolution binding */
  samlSPSSODescriptorArtifactResolutionServiceArtifact?: boolean;
  /** Want assertions signed */
  samlSPSSODescriptorWantAssertionsSigned?: boolean;
  /** AuthnRequest signed */
  samlSPSSODescriptorAuthnRequestsSigned?: boolean;
  /** Metadata validity (days) */
  samlMetadataValidityDays?: number;
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
 * SAML authentication result
 */
export interface SAMLAuthResult {
  /** Success status */
  success: boolean;
  /** User identifier (from NameID) */
  userId?: string;
  /** NameID value */
  nameId?: string;
  /** NameID format */
  nameIdFormat?: string;
  /** Session index */
  sessionIndex?: string;
  /** SAML attributes */
  attributes?: Record<string, string[]>;
  /** IdP entity ID */
  idpEntityId?: string;
  /** Lasso Identity dump */
  identityDump?: string;
  /** Lasso Session dump */
  sessionDump?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * SAML redirect response
 */
export interface SAMLRedirectResponse {
  /** Redirect URL */
  url: string;
  /** HTTP method (GET for redirect, POST for form) */
  method: "GET" | "POST";
  /** Form data for POST binding */
  formData?: {
    SAMLRequest?: string;
    SAMLResponse?: string;
    RelayState?: string;
  };
}
