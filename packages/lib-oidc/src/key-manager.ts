/**
 * Key Manager for OIDC
 *
 * Handles loading and managing signing/encryption keys for OIDC operations.
 * Supports RSA and EC keys in PEM format.
 */

import * as jose from "jose";
import { createHash } from "crypto";
import { KeyConfig, JWKS, SigningAlgorithm, Logger } from "./types";

/**
 * Configuration for KeyManager
 */
export interface KeyManagerConfig {
  /** Private key for signing (PEM format) */
  oidcServicePrivateKeySig?: string;
  /** Public key/certificate for signing (PEM format) */
  oidcServicePublicKeySig?: string;
  /** Key ID for signing key */
  oidcServiceKeyIdSig?: string;
  /** Key type for signing (RSA or EC) */
  oidcServiceKeyTypeSig?: "RSA" | "EC";
  /** Private key for encryption (PEM format) */
  oidcServicePrivateKeyEnc?: string;
  /** Public key for encryption (PEM format) */
  oidcServicePublicKeyEnc?: string;
  /** Key type for encryption (RSA or EC) */
  oidcServiceKeyTypeEnc?: "RSA" | "EC";
  /** Old private key for encryption (key rotation) */
  oidcServiceOldPrivateKeyEnc?: string;
  /** Old public key for encryption (key rotation) */
  oidcServiceOldPublicKeyEnc?: string;
  /** Old key type for encryption */
  oidcServiceOldKeyTypeEnc?: "RSA" | "EC";
}

/**
 * Extract key type from PEM content
 */
function detectKeyType(pem: string): "RSA" | "EC" {
  if (pem.includes("EC PRIVATE KEY") || pem.includes("EC PUBLIC KEY")) {
    return "EC";
  }
  return "RSA";
}

/**
 * Detect algorithm from key type
 */
function detectAlgorithm(keyType: "RSA" | "EC", use: "sig" | "enc"): string {
  if (use === "enc") {
    return keyType === "RSA" ? "RSA-OAEP" : "ECDH-ES";
  }
  return keyType === "RSA" ? "RS256" : "ES256";
}

/**
 * Generate key ID from public key (thumbprint)
 */
async function generateKeyId(key: jose.KeyLike): Promise<string> {
  const jwk = await jose.exportJWK(key);
  const thumbprint = await jose.calculateJwkThumbprint(jwk, "sha256");
  return thumbprint.substring(0, 16);
}

/**
 * Generate x5t (X.509 Certificate Thumbprint) from certificate
 */
function generateX5t(cert: string): string {
  // Extract the base64 content from PEM
  const base64 = cert
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");

  const der = Buffer.from(base64, "base64");
  const hash = createHash("sha1").update(der).digest();
  return jose.base64url.encode(hash);
}

/**
 * Key Manager class
 */
export class KeyManager {
  private config: KeyManagerConfig;
  private logger: Logger;
  private signingKey: KeyConfig | null = null;
  private encryptionKey: KeyConfig | null = null;
  private oldEncryptionKey: KeyConfig | null = null;
  private initialized = false;

  constructor(config: KeyManagerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize keys from configuration
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Load signing key
    if (this.config.oidcServicePrivateKeySig) {
      try {
        // Detect key type first to determine the algorithm
        const keyType =
          this.config.oidcServiceKeyTypeSig ||
          detectKeyType(this.config.oidcServicePrivateKeySig);
        const alg = detectAlgorithm(keyType, "sig");
        const privateKey = await jose.importPKCS8(
          this.config.oidcServicePrivateKeySig,
          alg,
        );
        const kid =
          this.config.oidcServiceKeyIdSig || (await generateKeyId(privateKey));

        this.signingKey = {
          kid,
          alg,
          kty: keyType,
          use: "sig",
          key: privateKey,
          cert: this.config.oidcServicePublicKeySig,
        };

        this.logger.info(
          `OIDC KeyManager: Signing key loaded (${alg}, kid=${kid})`,
        );
      } catch (err) {
        this.logger.error(
          `OIDC KeyManager: Failed to load signing key: ${err}`,
        );
      }
    }

    // Load encryption key
    if (this.config.oidcServicePrivateKeyEnc) {
      try {
        // Detect key type first to determine the algorithm
        const keyType =
          this.config.oidcServiceKeyTypeEnc ||
          detectKeyType(this.config.oidcServicePrivateKeyEnc);
        const alg = detectAlgorithm(keyType, "enc");
        const privateKey = await jose.importPKCS8(
          this.config.oidcServicePrivateKeyEnc,
          alg,
        );
        const kid = await generateKeyId(privateKey);

        this.encryptionKey = {
          kid,
          alg,
          kty: keyType,
          use: "enc",
          key: privateKey,
        };

        this.logger.info(`OIDC KeyManager: Encryption key loaded (${alg})`);
      } catch (err) {
        this.logger.error(
          `OIDC KeyManager: Failed to load encryption key: ${err}`,
        );
      }
    }

    // Load old encryption key (for key rotation)
    if (this.config.oidcServiceOldPrivateKeyEnc) {
      try {
        // Detect key type first to determine the algorithm
        const keyType =
          this.config.oidcServiceOldKeyTypeEnc ||
          detectKeyType(this.config.oidcServiceOldPrivateKeyEnc);
        const alg = detectAlgorithm(keyType, "enc");
        const privateKey = await jose.importPKCS8(
          this.config.oidcServiceOldPrivateKeyEnc,
          alg,
        );
        const kid = await generateKeyId(privateKey);

        this.oldEncryptionKey = {
          kid,
          alg,
          kty: keyType,
          use: "enc",
          key: privateKey,
        };

        this.logger.info(
          `OIDC KeyManager: Old encryption key loaded for rotation`,
        );
      } catch (err) {
        this.logger.warn(
          `OIDC KeyManager: Failed to load old encryption key: ${err}`,
        );
      }
    }

    this.initialized = true;
  }

  /**
   * Get the signing key
   */
  getSigningKey(): KeyConfig | null {
    return this.signingKey;
  }

  /**
   * Get the encryption key
   */
  getEncryptionKey(): KeyConfig | null {
    return this.encryptionKey;
  }

  /**
   * Get the old encryption key (for decryption during rotation)
   */
  getOldEncryptionKey(): KeyConfig | null {
    return this.oldEncryptionKey;
  }

  /**
   * Build JWKS document with public keys
   */
  async buildJWKS(): Promise<JWKS> {
    const keys: jose.JWK[] = [];

    // Add signing key
    if (this.signingKey) {
      let publicKey: jose.KeyLike;

      // If we have a certificate, extract public key from it
      if (this.config.oidcServicePublicKeySig) {
        if (this.config.oidcServicePublicKeySig.includes("CERTIFICATE")) {
          publicKey = await jose.importX509(
            this.config.oidcServicePublicKeySig,
            this.signingKey.alg as SigningAlgorithm,
          );
        } else {
          publicKey = await jose.importSPKI(
            this.config.oidcServicePublicKeySig,
            this.signingKey.alg as SigningAlgorithm,
          );
        }
      } else {
        // Export public key from private key
        const jwk = await jose.exportJWK(this.signingKey.key);
        // Remove private key components
        delete jwk.d;
        delete jwk.p;
        delete jwk.q;
        delete jwk.dp;
        delete jwk.dq;
        delete jwk.qi;
        publicKey = (await jose.importJWK(
          jwk,
          this.signingKey.alg,
        )) as jose.KeyLike;
      }

      const jwk = await jose.exportJWK(publicKey);
      jwk.kid = this.signingKey.kid;
      jwk.use = "sig";
      jwk.alg = this.signingKey.alg;

      // Add x5t if we have a certificate
      if (this.config.oidcServicePublicKeySig?.includes("CERTIFICATE")) {
        jwk.x5t = generateX5t(this.config.oidcServicePublicKeySig);
      }

      keys.push(jwk);
    }

    // Add encryption key
    if (this.encryptionKey) {
      try {
        let publicKey: jose.KeyLike;

        if (this.config.oidcServicePublicKeyEnc) {
          if (this.config.oidcServicePublicKeyEnc.includes("CERTIFICATE")) {
            publicKey = await jose.importX509(
              this.config.oidcServicePublicKeyEnc,
              this.encryptionKey.alg,
            );
          } else {
            publicKey = await jose.importSPKI(
              this.config.oidcServicePublicKeyEnc,
              this.encryptionKey.alg,
            );
          }
        } else {
          // Export public key from private key
          const jwk = await jose.exportJWK(this.encryptionKey.key);
          // Remove private key components
          delete jwk.d;
          delete jwk.p;
          delete jwk.q;
          delete jwk.dp;
          delete jwk.dq;
          delete jwk.qi;
          publicKey = (await jose.importJWK(
            jwk,
            this.encryptionKey.alg,
          )) as jose.KeyLike;
        }

        const jwk = await jose.exportJWK(publicKey);
        jwk.kid = this.encryptionKey.kid;
        jwk.use = "enc";
        jwk.alg = this.encryptionKey.alg;

        keys.push(jwk);
      } catch (err) {
        this.logger.warn(
          `OIDC KeyManager: Failed to export encryption public key: ${err}`,
        );
      }
    }

    // Add old encryption key (for key rotation - clients need to be able to encrypt with it)
    if (this.oldEncryptionKey) {
      try {
        // Export public key from private key
        const exportedJwk = await jose.exportJWK(this.oldEncryptionKey.key);
        // Remove private key components
        delete exportedJwk.d;
        delete exportedJwk.p;
        delete exportedJwk.q;
        delete exportedJwk.dp;
        delete exportedJwk.dq;
        delete exportedJwk.qi;
        const publicKey = (await jose.importJWK(
          exportedJwk,
          this.oldEncryptionKey.alg,
        )) as jose.KeyLike;

        const jwk = await jose.exportJWK(publicKey);
        jwk.kid = this.oldEncryptionKey.kid;
        jwk.use = "enc";
        jwk.alg = this.oldEncryptionKey.alg;

        keys.push(jwk);
      } catch (err) {
        this.logger.warn(
          `OIDC KeyManager: Failed to export old encryption public key: ${err}`,
        );
      }
    }

    return { keys };
  }

  /**
   * Sign a JWT
   */
  async signJWT(
    payload: jose.JWTPayload,
    options?: {
      alg?: SigningAlgorithm;
      typ?: string;
      extraHeaders?: Record<string, unknown>;
    },
  ): Promise<string> {
    if (!this.signingKey) {
      throw new Error("No signing key configured");
    }

    const alg = options?.alg || (this.signingKey.alg as SigningAlgorithm);
    const header: jose.JWTHeaderParameters = {
      alg,
      typ: options?.typ || "JWT",
      kid: this.signingKey.kid,
      ...options?.extraHeaders,
    };

    return new jose.SignJWT(payload)
      .setProtectedHeader(header)
      .sign(this.signingKey.key);
  }

  /**
   * Verify a JWT signature
   */
  async verifyJWT(
    token: string,
    options?: jose.JWTVerifyOptions,
  ): Promise<jose.JWTVerifyResult> {
    if (!this.signingKey) {
      throw new Error("No signing key configured");
    }

    // For verification, we need the public key
    const jwk = await jose.exportJWK(this.signingKey.key);
    // Remove private components to get public key
    delete jwk.d;
    delete jwk.p;
    delete jwk.q;
    delete jwk.dp;
    delete jwk.dq;
    delete jwk.qi;

    const publicKey = (await jose.importJWK(
      jwk,
      this.signingKey.alg,
    )) as jose.KeyLike;
    return jose.jwtVerify(token, publicKey, options);
  }

  /**
   * Encrypt a JWT (create JWE)
   */
  async encryptJWT(
    jwt: string,
    recipientPublicKey: jose.KeyLike,
    options: {
      alg: string;
      enc: string;
    },
  ): Promise<string> {
    return new jose.CompactEncrypt(new TextEncoder().encode(jwt))
      .setProtectedHeader({
        alg: options.alg,
        enc: options.enc,
        cty: "JWT",
      })
      .encrypt(recipientPublicKey);
  }

  /**
   * Decrypt a JWE
   */
  async decryptJWE(jwe: string): Promise<string> {
    // Try current encryption key
    if (this.encryptionKey) {
      try {
        const { plaintext } = await jose.compactDecrypt(
          jwe,
          this.encryptionKey.key,
        );
        return new TextDecoder().decode(plaintext);
      } catch {
        // Try old key if available
      }
    }

    // Try old encryption key (for key rotation)
    if (this.oldEncryptionKey) {
      try {
        const { plaintext } = await jose.compactDecrypt(
          jwe,
          this.oldEncryptionKey.key,
        );
        return new TextDecoder().decode(plaintext);
      } catch {
        // Both keys failed
      }
    }

    throw new Error("Failed to decrypt JWE with available keys");
  }

  /**
   * Create a symmetric key from client secret for HS* algorithms
   */
  async createSecretKey(secret: string): Promise<jose.KeyLike> {
    return (await jose.importJWK({
      kty: "oct",
      k: jose.base64url.encode(new TextEncoder().encode(secret)),
    })) as jose.KeyLike;
  }

  /**
   * Sign with HMAC (client secret)
   */
  async signWithSecret(
    payload: jose.JWTPayload,
    secret: string,
    alg: "HS256" | "HS384" | "HS512" = "HS256",
  ): Promise<string> {
    const key = await this.createSecretKey(secret);
    return new jose.SignJWT(payload)
      .setProtectedHeader({ alg, typ: "JWT" })
      .sign(key);
  }
}

export default KeyManager;
