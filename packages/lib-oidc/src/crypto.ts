/**
 * OIDC Cryptographic Utilities
 *
 * Implements hash functions required by OIDC spec for token binding.
 */

import { createHash } from "crypto";
import * as jose from "jose";

/**
 * Compute at_hash or c_hash for ID Token
 *
 * Per OIDC Core spec section 3.3.2.11:
 * at_hash: Access Token hash value. Its value is the base64url encoding
 * of the left-most half of the hash of the octets of the ASCII representation
 * of the access_token value, where the hash algorithm used is the hash
 * algorithm used in the alg Header Parameter of the ID Token's JOSE Header.
 *
 * @param value - The access_token or code value to hash
 * @param alg - The signing algorithm (RS256, ES256, etc.)
 * @returns Base64url encoded left-half of the hash
 */
export function computeHash(value: string, alg: string): string {
  // Determine hash algorithm from signing algorithm
  const hashAlg = getHashAlgorithm(alg);

  // Hash the ASCII representation
  const hash = createHash(hashAlg).update(value, "ascii").digest();

  // Take left-most half
  const leftHalf = hash.subarray(0, hash.length / 2);

  // Base64url encode
  return jose.base64url.encode(leftHalf);
}

/**
 * Compute at_hash (Access Token Hash) for ID Token
 *
 * @param accessToken - The access token value
 * @param alg - The signing algorithm used for ID Token
 * @returns Base64url encoded at_hash value
 */
export function computeAtHash(accessToken: string, alg: string): string {
  return computeHash(accessToken, alg);
}

/**
 * Compute c_hash (Code Hash) for ID Token
 *
 * @param code - The authorization code value
 * @param alg - The signing algorithm used for ID Token
 * @returns Base64url encoded c_hash value
 */
export function computeCHash(code: string, alg: string): string {
  return computeHash(code, alg);
}

/**
 * Compute s_hash (State Hash) for ID Token (FAPI)
 *
 * @param state - The state value
 * @param alg - The signing algorithm used for ID Token
 * @returns Base64url encoded s_hash value
 */
export function computeSHash(state: string, alg: string): string {
  return computeHash(state, alg);
}

/**
 * Get the hash algorithm name from the signing algorithm
 *
 * @param alg - The signing algorithm (RS256, ES384, PS512, etc.)
 * @returns Node.js hash algorithm name (sha256, sha384, sha512)
 */
function getHashAlgorithm(alg: string): string {
  // Extract the number from the algorithm name
  const match = alg.match(/(\d{3})$/);
  if (match) {
    const bits = match[1];
    switch (bits) {
      case "256":
        return "sha256";
      case "384":
        return "sha384";
      case "512":
        return "sha512";
    }
  }

  // EdDSA uses SHA-512
  if (alg === "EdDSA") {
    return "sha512";
  }

  // Default to SHA-256
  return "sha256";
}

/**
 * Verify at_hash value matches the access token
 *
 * @param atHash - The at_hash claim from the ID Token
 * @param accessToken - The access token to verify against
 * @param alg - The signing algorithm used for ID Token
 * @returns true if at_hash matches
 */
export function verifyAtHash(
  atHash: string,
  accessToken: string,
  alg: string,
): boolean {
  const computed = computeAtHash(accessToken, alg);
  return atHash === computed;
}

/**
 * Verify c_hash value matches the authorization code
 *
 * @param cHash - The c_hash claim from the ID Token
 * @param code - The authorization code to verify against
 * @param alg - The signing algorithm used for ID Token
 * @returns true if c_hash matches
 */
export function verifyCHash(cHash: string, code: string, alg: string): boolean {
  const computed = computeCHash(code, alg);
  return cHash === computed;
}

/**
 * Generate a random string suitable for use as code, state, nonce, etc.
 *
 * @param length - The desired length in bytes (will be base64url encoded)
 * @returns Random base64url encoded string
 */
export function generateRandomString(length: number = 32): string {
  const { randomBytes } = require("crypto");
  return jose.base64url.encode(randomBytes(length));
}

/**
 * Generate PKCE code_verifier
 *
 * Per RFC 7636, code_verifier is a high-entropy cryptographic random string
 * using unreserved characters [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 * with a minimum length of 43 characters and a maximum length of 128 characters.
 *
 * @returns Random code_verifier string
 */
export function generateCodeVerifier(): string {
  const { randomBytes } = require("crypto");
  // 32 bytes = 43 base64url characters (minimum required)
  return jose.base64url.encode(randomBytes(32));
}

/**
 * Generate PKCE code_challenge from code_verifier
 *
 * @param codeVerifier - The code_verifier value
 * @param method - The challenge method (S256 or plain)
 * @returns The code_challenge value
 */
export function generateCodeChallenge(
  codeVerifier: string,
  method: "S256" | "plain" = "S256",
): string {
  if (method === "plain") {
    return codeVerifier;
  }

  // S256: BASE64URL(SHA256(code_verifier))
  const hash = createHash("sha256").update(codeVerifier, "ascii").digest();
  return jose.base64url.encode(hash);
}

/**
 * Verify PKCE code_challenge matches code_verifier
 *
 * @param codeChallenge - The code_challenge from authorization request
 * @param codeVerifier - The code_verifier from token request
 * @param method - The challenge method used
 * @returns true if verification succeeds
 */
export function verifyCodeChallenge(
  codeChallenge: string,
  codeVerifier: string,
  method: "S256" | "plain" = "S256",
): boolean {
  const computed = generateCodeChallenge(codeVerifier, method);
  return codeChallenge === computed;
}
