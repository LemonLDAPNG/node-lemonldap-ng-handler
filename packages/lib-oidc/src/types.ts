/**
 * OIDC Library Types
 */

import { KeyLike, JWK } from "jose";

/**
 * Key configuration for signing or encryption
 */
export interface KeyConfig {
  /** Key ID (kid) */
  kid: string;
  /** Algorithm (RS256, ES256, etc.) */
  alg: string;
  /** Key type (RSA, EC, oct) */
  kty: "RSA" | "EC" | "oct";
  /** Use (sig or enc) */
  use: "sig" | "enc";
  /** The actual key object */
  key: KeyLike;
  /** Optional certificate (for x5t) */
  cert?: string;
}

/**
 * JWKS (JSON Web Key Set)
 */
export interface JWKS {
  keys: JWK[];
}

/**
 * Supported signing algorithms
 */
export type SigningAlgorithm =
  | "RS256"
  | "RS384"
  | "RS512"
  | "PS256"
  | "PS384"
  | "PS512"
  | "ES256"
  | "ES384"
  | "ES512"
  | "EdDSA"
  | "HS256"
  | "HS384"
  | "HS512";

/**
 * Supported key encryption algorithms
 */
export type KeyEncryptionAlgorithm =
  | "RSA-OAEP"
  | "RSA-OAEP-256"
  | "RSA1_5"
  | "A128KW"
  | "A192KW"
  | "A256KW"
  | "dir"
  | "ECDH-ES"
  | "ECDH-ES+A128KW"
  | "ECDH-ES+A192KW"
  | "ECDH-ES+A256KW";

/**
 * Supported content encryption algorithms
 */
export type ContentEncryptionAlgorithm =
  | "A128CBC-HS256"
  | "A192CBC-HS384"
  | "A256CBC-HS512"
  | "A128GCM"
  | "A192GCM"
  | "A256GCM";

/**
 * Token claims for ID Token
 */
export interface IDTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  auth_time?: number;
  nonce?: string;
  acr?: string;
  amr?: string[];
  azp?: string;
  at_hash?: string;
  c_hash?: string;
  sid?: string;
  [key: string]: unknown;
}

/**
 * Token claims for Access Token (JWT format)
 */
export interface AccessTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nbf?: number;
  jti: string;
  client_id: string;
  scope: string;
  sid?: string;
  [key: string]: unknown;
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
