/**
 * @lemonldap-ng/auth-oidc
 *
 * OIDC Authentication module (Relying Party) for LemonLDAP::NG
 *
 * Implements OpenID Connect Relying Party functionality:
 * - OP discovery and configuration
 * - Authorization code flow with PKCE
 * - Token exchange
 * - ID token validation
 * - User info retrieval
 * - Session attribute mapping
 */

// Main auth class
export { OIDCAuth } from "./auth";

// Types
export {
  OIDCOPConfig,
  OIDCOPOptions,
  OIDCAuthConfig,
  OIDCStateData,
  OIDCAuthResult,
  OPListItem,
  Logger,
} from "./types";

// Default export
export { OIDCAuth as default } from "./auth";
