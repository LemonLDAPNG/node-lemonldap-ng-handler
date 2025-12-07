/**
 * @lemonldap-ng/lib-oidc
 *
 * OIDC utilities library providing:
 * - Key management (RSA/EC signing and encryption keys)
 * - JWT/JWE operations via jose
 * - OIDC-specific hash functions (at_hash, c_hash, PKCE)
 * - Type definitions for OIDC tokens and claims
 */

// Key Manager
export { KeyManager, KeyManagerConfig } from "./key-manager";

// Crypto utilities
export {
  computeHash,
  computeAtHash,
  computeCHash,
  computeSHash,
  verifyAtHash,
  verifyCHash,
  generateRandomString,
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
} from "./crypto";

// Types
export {
  KeyConfig,
  JWKS,
  SigningAlgorithm,
  KeyEncryptionAlgorithm,
  ContentEncryptionAlgorithm,
  IDTokenClaims,
  AccessTokenClaims,
  Logger,
} from "./types";

// Re-export commonly used jose types for convenience
export type { JWK, JWTPayload, JWTVerifyResult, KeyLike } from "jose";
