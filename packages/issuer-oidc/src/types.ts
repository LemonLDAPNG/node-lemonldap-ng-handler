/**
 * OIDC Provider (Issuer) Types
 *
 * Configuration interfaces compatible with LemonLDAP::NG Perl configuration.
 */

import { Logger } from "@lemonldap-ng/lib-oidc";

/**
 * OIDC Service Configuration (OP-level settings)
 * Corresponds to Perl oidcServiceMetaData* parameters
 */
export interface OIDCServiceConfig {
  /** Issuer identifier (URL) */
  oidcServiceMetaDataIssuer?: string;

  // Endpoint URIs (paths, not full URLs)
  /** Authorization endpoint URI (default: "authorize") */
  oidcServiceMetaDataAuthorizeURI?: string;
  /** Token endpoint URI (default: "token") */
  oidcServiceMetaDataTokenURI?: string;
  /** UserInfo endpoint URI (default: "userinfo") */
  oidcServiceMetaDataUserInfoURI?: string;
  /** JWKS endpoint URI (default: "jwks") */
  oidcServiceMetaDataJWKSURI?: string;
  /** Registration endpoint URI (default: "register") */
  oidcServiceMetaDataRegistrationURI?: string;
  /** Introspection endpoint URI (default: "introspect") */
  oidcServiceMetaDataIntrospectionURI?: string;
  /** Revocation endpoint URI (default: "revoke") */
  oidcServiceMetaDataRevokeURI?: string;
  /** End session endpoint URI (default: "logout") */
  oidcServiceMetaDataEndSessionURI?: string;
  /** Check session endpoint URI (default: "checksession.html") */
  oidcServiceMetaDataCheckSessionURI?: string;
  /** Front-channel logout URI (default: "flogout") */
  oidcServiceMetaDataFrontChannelURI?: string;
  /** Back-channel logout URI (default: "blogout") */
  oidcServiceMetaDataBackChannelURI?: string;
  /** RP logout return URI (default: "rlogoutreturn") */
  oidcServiceMetaDataRpLogoutReturnURI?: string;

  // Key configuration
  /** Private key for signing (PEM format) */
  oidcServicePrivateKeySig?: string;
  /** Public key/certificate for signing (PEM format) */
  oidcServicePublicKeySig?: string;
  /** Key ID for signing key */
  oidcServiceKeyIdSig?: string;
  /** Key type for signing (RSA or EC, default: "RSA") */
  oidcServiceKeyTypeSig?: "RSA" | "EC";

  /** Private key for encryption (PEM format) */
  oidcServicePrivateKeyEnc?: string;
  /** Public key for encryption (PEM format) */
  oidcServicePublicKeyEnc?: string;
  /** Key ID for encryption key */
  oidcServiceKeyIdEnc?: string;
  /** Key type for encryption (default: "RSA") */
  oidcServiceKeyTypeEnc?: "RSA" | "EC";

  /** Old private key for signing (key rotation) */
  oidcServiceOldPrivateKeySig?: string;
  /** Old public key for signing (key rotation) */
  oidcServiceOldPublicKeySig?: string;
  /** Old key ID for signing */
  oidcServiceOldKeyIdSig?: string;
  /** Old key type for signing */
  oidcServiceOldKeyTypeSig?: "RSA" | "EC";

  /** Old private key for encryption (key rotation) */
  oidcServiceOldPrivateKeyEnc?: string;
  /** Old public key for encryption (key rotation) */
  oidcServiceOldPublicKeyEnc?: string;
  /** Old key ID for encryption */
  oidcServiceOldKeyIdEnc?: string;
  /** Old key type for encryption */
  oidcServiceOldKeyTypeEnc?: "RSA" | "EC";

  // Flow configuration
  /** Allow authorization code flow (default: true) */
  oidcServiceAllowAuthorizationCodeFlow?: boolean;
  /** Allow implicit flow (default: false) */
  oidcServiceAllowImplicitFlow?: boolean;
  /** Allow hybrid flow (default: false) */
  oidcServiceAllowHybridFlow?: boolean;

  // Encryption algorithms
  /** Key encryption algorithm (default: "RSA-OAEP") */
  oidcServiceEncAlgorithmAlg?: string;
  /** Content encryption algorithm (default: "A256GCM") */
  oidcServiceEncAlgorithmEnc?: string;

  // Token expiration times (in seconds)
  /** Authorization code expiration (default: 60) */
  oidcServiceAuthorizationCodeExpiration?: number;
  /** ID token expiration (default: 3600) */
  oidcServiceIDTokenExpiration?: number;
  /** Access token expiration (default: 3600) */
  oidcServiceAccessTokenExpiration?: number;
  /** Offline session expiration for refresh tokens (default: 2592000) */
  oidcServiceOfflineSessionExpiration?: number;

  // Feature flags
  /** Ignore scope when returning claims (default: false) */
  oidcServiceIgnoreScopeForClaims?: boolean;
  /** Allow only declared scopes (default: false) */
  oidcServiceAllowOnlyDeclaredScopes?: boolean;
  /** Hide metadata endpoint (default: false) */
  oidcServiceHideMetadata?: boolean;
  /** Disallow "none" algorithm (default: false) */
  oidcServiceMetaDataDisallowNoneAlg?: boolean;
  /** Allow dynamic registration (default: false) */
  oidcServiceAllowDynamicRegistration?: boolean;

  // Authentication context and AMR rules
  /** Authentication context to ACR mapping */
  oidcServiceMetaDataAuthnContext?: Record<string, string>;
  /** AMR (Authentication Methods References) rules */
  oidcServiceMetaDataAmrRules?: Record<string, string>;

  // Dynamic registration
  /** Exported vars for dynamic registration */
  oidcServiceDynamicRegistrationExportedVars?: Record<string, string>;
  /** Extra claims for dynamic registration */
  oidcServiceDynamicRegistrationExtraClaims?: Record<string, string>;
}

/**
 * Relying Party (RP) Options
 * Corresponds to Perl oidcRPMetaDataOptions* parameters
 */
export interface OIDCRPOptions {
  /** Client ID */
  oidcRPMetaDataOptionsClientID: string;
  /** Client secret (for confidential clients) */
  oidcRPMetaDataOptionsClientSecret?: string;
  /** Display name */
  oidcRPMetaDataOptionsDisplayName?: string;
  /** Icon URL */
  oidcRPMetaDataOptionsIcon?: string;

  // Redirect URIs
  /** Allowed redirect URIs */
  oidcRPMetaDataOptionsRedirectUris?: string[];
  /** Post-logout redirect URIs */
  oidcRPMetaDataOptionsPostLogoutRedirectUris?: string[];

  // Logout configuration
  /** Front-channel logout URI */
  oidcRPMetaDataOptionsFrontChannelLogoutURI?: string;
  /** Back-channel logout URI */
  oidcRPMetaDataOptionsBackChannelLogoutURI?: string;
  /** Front-channel logout requires session (default: false) */
  oidcRPMetaDataOptionsFrontChannelLogoutSessionRequired?: boolean;
  /** Back-channel logout requires session (default: false) */
  oidcRPMetaDataOptionsBackChannelLogoutSessionRequired?: boolean;

  // Token configuration
  /** Token endpoint authentication method */
  oidcRPMetaDataOptionsTokenEndpointAuthMethod?:
    | "client_secret_basic"
    | "client_secret_post"
    | "client_secret_jwt"
    | "private_key_jwt"
    | "none";
  /** ID token signing algorithm */
  oidcRPMetaDataOptionsIDTokenSignAlg?: string;
  /** Access token format (opaque or jwt) */
  oidcRPMetaDataOptionsAccessTokenFormat?: "opaque" | "jwt";
  /** Access token signing algorithm */
  oidcRPMetaDataOptionsAccessTokenSignAlg?: string;
  /** ID token encryption algorithm */
  oidcRPMetaDataOptionsIDTokenEncAlg?: string;
  /** ID token content encryption algorithm */
  oidcRPMetaDataOptionsIDTokenEncEnc?: string;
  /** UserInfo signing algorithm */
  oidcRPMetaDataOptionsUserInfoSignAlg?: string;
  /** UserInfo encryption algorithm */
  oidcRPMetaDataOptionsUserInfoEncAlg?: string;
  /** UserInfo content encryption algorithm */
  oidcRPMetaDataOptionsUserInfoEncEnc?: string;

  // PKCE configuration
  /** Require PKCE (default: false) */
  oidcRPMetaDataOptionsRequirePKCE?: boolean;
  /** Allow PKCE plain method (default: false) */
  oidcRPMetaDataOptionsAllowPKCEPlain?: boolean;

  // Scopes and claims
  /** Allowed scopes */
  oidcRPMetaDataOptionsScopes?: string[];
  /** Extra claims to include */
  oidcRPMetaDataOptionsExtraClaims?: Record<string, string>;

  // Expiration overrides
  /** Authorization code expiration override */
  oidcRPMetaDataOptionsAuthorizationCodeExpiration?: number;
  /** ID token expiration override */
  oidcRPMetaDataOptionsIDTokenExpiration?: number;
  /** Access token expiration override */
  oidcRPMetaDataOptionsAccessTokenExpiration?: number;
  /** Offline session expiration override */
  oidcRPMetaDataOptionsOfflineSessionExpiration?: number;

  // Consent
  /** Bypass consent screen (default: false) */
  oidcRPMetaDataOptionsBypassConsent?: boolean;
  /** Force consent on each login (default: false) */
  oidcRPMetaDataOptionsForceConsent?: boolean;

  // Access control
  /** Rule for RP access (SafePerl expression) */
  oidcRPMetaDataOptionsRule?: string;
  /** Public client (no client secret) */
  oidcRPMetaDataOptionsPublic?: boolean;

  // JWT client auth
  /** JWKS URI for client (private_key_jwt auth) */
  oidcRPMetaDataOptionsJwks?: string;

  // Refresh tokens
  /** Allow offline access (refresh tokens) */
  oidcRPMetaDataOptionsAllowOffline?: boolean;
  /** Refresh token rotation */
  oidcRPMetaDataOptionsRefreshTokenRotation?: boolean;

  // Grant types
  /** Allow client_credentials grant */
  oidcRPMetaDataOptionsAllowClientCredentialsGrant?: boolean;
  /** Allow password grant */
  oidcRPMetaDataOptionsAllowPasswordGrant?: boolean;

  // Logout options
  /** Logout URL for front-channel logout */
  oidcRPMetaDataOptionsLogoutUrl?: string;
  /** Logout type (front or back) */
  oidcRPMetaDataOptionsLogoutType?: "front" | "back";
  /** Logout requires session */
  oidcRPMetaDataOptionsLogoutSessionRequired?: boolean;
  /** Bypass logout confirmation */
  oidcRPMetaDataOptionsLogoutBypassConfirm?: boolean;
}

/**
 * RP Exported Variables
 * Corresponds to Perl oidcRPMetaDataExportedVars
 */
export interface OIDCRPExportedVars {
  [varName: string]: string;
}

/**
 * RP Scopes Configuration
 * Corresponds to Perl oidcRPMetaDataOptionsScopes
 */
export interface OIDCRPScopesConfig {
  /** Scope name to claim list mapping */
  [scopeName: string]: string[];
}

/**
 * Complete RP Configuration
 */
export interface OIDCRPConfig {
  /** RP options */
  options: OIDCRPOptions;
  /** Exported variables (session attr -> claim mapping) */
  exportedVars?: OIDCRPExportedVars;
  /** Scope to claims mapping */
  scopeRules?: OIDCRPScopesConfig;
}

/**
 * OIDC Provider Configuration
 * This is the main configuration interface
 */
export interface OIDCProviderConfig extends OIDCServiceConfig {
  /** Registered RPs by confKey */
  oidcRPMetaDataOptions?: Record<string, OIDCRPOptions>;
  /** RP exported vars by confKey */
  oidcRPMetaDataExportedVars?: Record<string, OIDCRPExportedVars>;
  /** RP scope rules by confKey */
  oidcRPMetaDataScopeRules?: Record<string, OIDCRPScopesConfig>;

  /** Logger instance */
  logger?: Logger;

  /** Base path for OIDC routes */
  basePath?: string;

  /** Portal URL (used as fallback for issuer) */
  portal?: string;

  /**
   * Callback to get user session data
   * Used by authorize/token endpoints to get user attributes
   */
  getSession?: (sessionId: string) => Promise<Record<string, unknown> | null>;

  /**
   * Callback to store authorization code
   */
  storeAuthCode?: (code: string, data: AuthCodeData) => Promise<void>;

  /**
   * Callback to retrieve and delete authorization code
   */
  consumeAuthCode?: (code: string) => Promise<AuthCodeData | null>;

  /**
   * Callback to store access token
   */
  storeAccessToken?: (token: string, data: AccessTokenData) => Promise<void>;

  /**
   * Callback to retrieve access token
   */
  getAccessToken?: (token: string) => Promise<AccessTokenData | null>;

  /**
   * Callback to revoke access token
   */
  revokeAccessToken?: (token: string) => Promise<void>;

  /**
   * Callback to store refresh token
   */
  storeRefreshToken?: (token: string, data: RefreshTokenData) => Promise<void>;

  /**
   * Callback to retrieve refresh token
   */
  getRefreshToken?: (token: string) => Promise<RefreshTokenData | null>;

  /**
   * Callback to revoke refresh token
   */
  revokeRefreshToken?: (token: string) => Promise<void>;

  /**
   * Callback to register a new RP (for dynamic registration)
   * Should save the RP configuration and return the confKey
   */
  registerRP?: (
    confKey: string,
    options: OIDCRPOptions,
    exportedVars?: OIDCRPExportedVars,
  ) => Promise<boolean>;
}

/**
 * Authorization Code Data
 */
export interface AuthCodeData {
  clientId: string;
  redirectUri: string;
  scope: string;
  userId: string;
  sessionId: string;
  nonce?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: "S256" | "plain";
  authTime: number;
  createdAt: number;
  expiresAt: number;
}

/**
 * Access Token Data
 */
export interface AccessTokenData {
  clientId: string;
  userId: string;
  sessionId: string;
  scope: string;
  createdAt: number;
  expiresAt: number;
  /** For JWT access tokens, the JTI claim */
  jti?: string;
}

/**
 * Refresh Token Data
 */
export interface RefreshTokenData {
  clientId: string;
  userId: string;
  sessionId: string;
  scope: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * OpenID Connect Discovery Metadata
 * Per OpenID Connect Discovery 1.0
 */
export interface OIDCDiscoveryMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  registration_endpoint?: string;
  introspection_endpoint?: string;
  revocation_endpoint?: string;
  end_session_endpoint?: string;
  check_session_iframe?: string;
  frontchannel_logout_supported?: boolean;
  frontchannel_logout_session_supported?: boolean;
  backchannel_logout_supported?: boolean;
  backchannel_logout_session_supported?: boolean;
  scopes_supported?: string[];
  response_types_supported: string[];
  response_modes_supported?: string[];
  grant_types_supported?: string[];
  acr_values_supported?: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  id_token_encryption_alg_values_supported?: string[];
  id_token_encryption_enc_values_supported?: string[];
  userinfo_signing_alg_values_supported?: string[];
  userinfo_encryption_alg_values_supported?: string[];
  userinfo_encryption_enc_values_supported?: string[];
  request_object_signing_alg_values_supported?: string[];
  request_object_encryption_alg_values_supported?: string[];
  request_object_encryption_enc_values_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  token_endpoint_auth_signing_alg_values_supported?: string[];
  claim_types_supported?: string[];
  claims_supported?: string[];
  claims_parameter_supported?: boolean;
  request_parameter_supported?: boolean;
  request_uri_parameter_supported?: boolean;
  require_request_uri_registration?: boolean;
  code_challenge_methods_supported?: string[];
}

/**
 * Token Response
 */
export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

/**
 * Token Error Response
 */
export interface TokenErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/**
 * Introspection Response
 */
export interface IntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  aud?: string | string[];
  iss?: string;
  jti?: string;
  [key: string]: unknown;
}

/**
 * Authorization Request
 */
export interface AuthorizationRequest {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope?: string;
  state?: string;
  nonce?: string;
  response_mode?: "query" | "fragment" | "form_post";
  display?: "page" | "popup" | "touch" | "wap";
  prompt?: string;
  max_age?: number;
  ui_locales?: string;
  id_token_hint?: string;
  login_hint?: string;
  acr_values?: string;
  code_challenge?: string;
  code_challenge_method?: "S256" | "plain";
  request?: string;
  request_uri?: string;
  claims?: string;
}

/**
 * Token Request
 */
export interface TokenRequest {
  grant_type: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  client_secret?: string;
  refresh_token?: string;
  scope?: string;
  code_verifier?: string;
  username?: string;
  password?: string;
  /** Client assertion JWT for client_secret_jwt or private_key_jwt auth */
  client_assertion?: string;
  /** Client assertion type (should be urn:ietf:params:oauth:client-assertion-type:jwt-bearer) */
  client_assertion_type?: string;
}

/**
 * UserInfo Response
 */
export interface UserInfoResponse {
  sub: string;
  [claim: string]: unknown;
}

/**
 * Dynamic Client Registration Request
 * Per RFC 7591 and OpenID Connect Dynamic Client Registration 1.0
 */
export interface ClientRegistrationRequest {
  /** Array of redirect URIs (required) */
  redirect_uris: string[];
  /** Human-readable client name */
  client_name?: string;
  /** Client logo URI */
  logo_uri?: string;
  /** Client home page URI */
  client_uri?: string;
  /** Client policy URI */
  policy_uri?: string;
  /** Client terms of service URI */
  tos_uri?: string;
  /** JWKS URI for client's public keys */
  jwks_uri?: string;
  /** Inline JWKS (alternative to jwks_uri) */
  jwks?: { keys: unknown[] };
  /** Token endpoint authentication method */
  token_endpoint_auth_method?:
    | "client_secret_basic"
    | "client_secret_post"
    | "client_secret_jwt"
    | "private_key_jwt"
    | "none";
  /** Requested grant types */
  grant_types?: string[];
  /** Requested response types */
  response_types?: string[];
  /** Subject type (public or pairwise) */
  subject_type?: "public" | "pairwise";
  /** ID token signed response algorithm */
  id_token_signed_response_alg?: string;
  /** ID token encrypted response algorithm */
  id_token_encrypted_response_alg?: string;
  /** ID token encrypted response encoding */
  id_token_encrypted_response_enc?: string;
  /** UserInfo signed response algorithm */
  userinfo_signed_response_alg?: string;
  /** UserInfo encrypted response algorithm */
  userinfo_encrypted_response_alg?: string;
  /** UserInfo encrypted response encoding */
  userinfo_encrypted_response_enc?: string;
  /** Request object signing algorithm */
  request_object_signing_alg?: string;
  /** Request URIs */
  request_uris?: string[];
  /** Back-channel logout URI */
  backchannel_logout_uri?: string;
  /** Back-channel logout requires session */
  backchannel_logout_session_required?: boolean;
  /** Front-channel logout URI */
  frontchannel_logout_uri?: string;
  /** Front-channel logout requires session */
  frontchannel_logout_session_required?: boolean;
  /** Post-logout redirect URIs */
  post_logout_redirect_uris?: string[];
  /** Contacts (email addresses) */
  contacts?: string[];
  /** Software ID */
  software_id?: string;
  /** Software version */
  software_version?: string;
  /** Additional properties */
  [key: string]: unknown;
}

/**
 * Dynamic Client Registration Response
 * Per RFC 7591 and OpenID Connect Dynamic Client Registration 1.0
 */
export interface ClientRegistrationResponse {
  /** Generated client ID */
  client_id: string;
  /** Generated client secret (for confidential clients) */
  client_secret?: string;
  /** Time at which client_id was issued (Unix timestamp) */
  client_id_issued_at: number;
  /** Time at which client_secret expires (0 = never) */
  client_secret_expires_at?: number;
  /** Client name */
  client_name?: string;
  /** Logo URI */
  logo_uri?: string;
  /** Redirect URIs */
  redirect_uris: string[];
  /** ID token signed response algorithm */
  id_token_signed_response_alg?: string;
  /** UserInfo signed response algorithm */
  userinfo_signed_response_alg?: string;
  /** Token endpoint authentication method */
  token_endpoint_auth_method?: string;
  /** Grant types */
  grant_types?: string[];
  /** Response types */
  response_types?: string[];
  /** Request URIs */
  request_uris?: string[];
  /** Registration access token (for configuration endpoint) */
  registration_access_token?: string;
  /** Registration client URI (for configuration endpoint) */
  registration_client_uri?: string;
}

/**
 * Dynamic Client Registration Error Response
 */
export interface ClientRegistrationErrorResponse {
  error:
    | "invalid_redirect_uri"
    | "invalid_client_metadata"
    | "invalid_software_statement"
    | "unapproved_software_statement"
    | "server_error";
  error_description?: string;
}

export { Logger };
