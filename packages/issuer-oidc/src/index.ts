/**
 * @lemonldap-ng/issuer-oidc
 *
 * OIDC Provider (Issuer) for LemonLDAP::NG
 *
 * Implements OpenID Connect Provider functionality:
 * - Discovery endpoint (.well-known/openid-configuration)
 * - JWKS endpoint
 * - Authorization endpoint
 * - Token endpoint
 * - UserInfo endpoint
 * - Introspection endpoint
 * - Revocation endpoint
 * - End session endpoint
 */

// Provider
export { OIDCProvider } from "./provider";

// Router
export { createOIDCRouter, OIDCRouterOptions } from "./router";

// Types
export {
  // Configuration
  OIDCServiceConfig,
  OIDCRPOptions,
  OIDCRPExportedVars,
  OIDCRPScopesConfig,
  OIDCRPConfig,
  OIDCProviderConfig,
  // Token data
  AuthCodeData,
  AccessTokenData,
  RefreshTokenData,
  // Metadata
  OIDCDiscoveryMetadata,
  // Requests/Responses
  TokenResponse,
  TokenErrorResponse,
  IntrospectionResponse,
  AuthorizationRequest,
  TokenRequest,
  UserInfoResponse,
  Logger,
} from "./types";

// Re-export lib-oidc utilities for convenience
export {
  KeyManager,
  computeAtHash,
  computeCHash,
  generateRandomString,
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
} from "@lemonldap-ng/lib-oidc";

// Default export
export { OIDCProvider as default } from "./provider";
