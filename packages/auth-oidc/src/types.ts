/**
 * OIDC Authentication (Relying Party) Types
 *
 * Configuration interfaces compatible with LemonLDAP::NG Perl configuration.
 */

/**
 * OpenID Provider (OP) configuration
 * Corresponds to Perl oidcOPMetaData* parameters
 */
export interface OIDCOPConfig {
  /** OP configuration key (identifier) */
  confKey: string;

  /** OP Metadata JSON (OpenID Discovery document) */
  oidcOPMetaDataJSON?: string;

  /** OP JWKS (JSON Web Key Set) */
  oidcOPMetaDataJWKS?: string;

  /** OP Options */
  oidcOPMetaDataOptions: OIDCOPOptions;

  /** Exported variables mapping (claim -> session attribute) */
  oidcOPMetaDataExportedVars?: Record<string, string>;
}

/**
 * OpenID Provider Options
 * Corresponds to Perl oidcOPMetaDataOptions* parameters
 */
export interface OIDCOPOptions {
  /** Client ID for this OP */
  oidcOPMetaDataOptionsClientID: string;
  /** Client secret for this OP */
  oidcOPMetaDataOptionsClientSecret?: string;

  // Discovery
  /** OP configuration URL (.well-known/openid-configuration) */
  oidcOPMetaDataOptionsConfigurationURI?: string;
  /** JWKS URI (if not in discovery) */
  oidcOPMetaDataOptionsJWKSURI?: string;

  // Endpoints (override discovery)
  /** Authorization endpoint */
  oidcOPMetaDataOptionsAuthorizeURI?: string;
  /** Token endpoint */
  oidcOPMetaDataOptionsTokenURI?: string;
  /** UserInfo endpoint */
  oidcOPMetaDataOptionsUserInfoURI?: string;
  /** End session endpoint */
  oidcOPMetaDataOptionsEndSessionURI?: string;

  // Display
  /** Display name for OP selection */
  oidcOPMetaDataOptionsDisplayName?: string;
  /** Icon URL for OP selection */
  oidcOPMetaDataOptionsIcon?: string;
  /** Tooltip for OP selection */
  oidcOPMetaDataOptionsTooltip?: string;
  /** Sort order for OP selection */
  oidcOPMetaDataOptionsSortNumber?: number;

  // Authentication
  /** Token endpoint authentication method */
  oidcOPMetaDataOptionsTokenEndpointAuthMethod?:
    | "client_secret_basic"
    | "client_secret_post"
    | "client_secret_jwt"
    | "private_key_jwt"
    | "none";

  // Scopes and claims
  /** Scope to request (default: "openid profile email") */
  oidcOPMetaDataOptionsScope?: string;
  /** Additional claims to request */
  oidcOPMetaDataOptionsExtraClaims?: string;

  // Token settings
  /** Check ID token signature (default: true) */
  oidcOPMetaDataOptionsCheckJWTSignature?: boolean;
  /** ID token max age in seconds */
  oidcOPMetaDataOptionsIDTokenMaxAge?: number;
  /** Use nonce in authorization request (default: true) */
  oidcOPMetaDataOptionsUseNonce?: boolean;

  // PKCE
  /** Use PKCE (default: false) */
  oidcOPMetaDataOptionsUsePKCE?: boolean;
  /** PKCE code challenge method (default: "S256") */
  oidcOPMetaDataOptionsPKCEMethod?: "S256" | "plain";

  // Response type
  /** Response type (default: "code") */
  oidcOPMetaDataOptionsResponseType?: string;

  // UserInfo
  /** Get user info from OP (default: true) */
  oidcOPMetaDataOptionsGetUserInfo?: boolean;

  // Logout
  /** Enable OP-initiated logout (default: true) */
  oidcOPMetaDataOptionsLogoutSessionRequired?: boolean;
  /** Back-channel logout support */
  oidcOPMetaDataOptionsBackChannelLogout?: boolean;
  /** Front-channel logout support */
  oidcOPMetaDataOptionsFrontChannelLogout?: boolean;

  // Access control
  /** Store access token in session */
  oidcOPMetaDataOptionsStoreAccessToken?: boolean;
  /** Store ID token in session */
  oidcOPMetaDataOptionsStoreIDToken?: boolean;

  // Prompt
  /** Prompt parameter value */
  oidcOPMetaDataOptionsPrompt?: string;

  // ACR
  /** Requested ACR values */
  oidcOPMetaDataOptionsAcrValues?: string;
}

/**
 * OIDC RP (Auth module) configuration
 */
export interface OIDCAuthConfig {
  /** Default OP to use (confKey) */
  oidcRPDefaultOP?: string;

  /** Callback path for OIDC response (default: "/oauth2/callback") */
  oidcRPCallbackPath?: string;

  /** State timeout in seconds (default: 600) */
  oidcRPStateTimeout?: number;

  /** Configured OPs by confKey */
  oidcOPMetaData?: Record<string, OIDCOPConfig>;

  /** Portal URL (for callback construction) */
  portal?: string;

  /** Logger instance */
  logger?: Logger;

  /**
   * Store state data (for authorization flow)
   */
  storeState?: (state: string, data: OIDCStateData) => Promise<void>;

  /**
   * Retrieve and delete state data
   */
  consumeState?: (state: string) => Promise<OIDCStateData | null>;
}

/**
 * State data stored during authorization flow
 */
export interface OIDCStateData {
  /** OP confKey */
  op: string;
  /** Nonce for ID token validation */
  nonce?: string;
  /** Code verifier for PKCE */
  codeVerifier?: string;
  /** Original URL to redirect after auth */
  urldc?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp */
  expiresAt: number;
}

/**
 * Authentication result from OIDC flow
 */
export interface OIDCAuthResult {
  /** Success flag */
  success: boolean;
  /** Error code if failed */
  error?: string;
  /** Error description */
  errorDescription?: string;
  /** User ID (subject from ID token) */
  userId?: string;
  /** User info claims */
  userInfo?: Record<string, unknown>;
  /** ID token (if stored) */
  idToken?: string;
  /** Access token (if stored) */
  accessToken?: string;
  /** Refresh token */
  refreshToken?: string;
  /** Session data to store */
  sessionData?: Record<string, unknown>;
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
 * OP list item for selection UI
 */
export interface OPListItem {
  /** OP confKey */
  val: string;
  /** Display name */
  name: string;
  /** Tooltip */
  title: string;
  /** Icon URL */
  icon?: string;
  /** Sort order */
  order: number;
}
