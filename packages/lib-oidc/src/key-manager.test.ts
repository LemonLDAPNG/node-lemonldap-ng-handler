/**
 * Tests for KeyManager
 */

import { KeyManager } from "./key-manager";
import { Logger } from "./types";

// Valid RSA private key (PKCS#8 format)
const TEST_RSA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCqXUa48j+R8Fj5
h/y9iRmXN5DsX4FRCQ2JqiT7iTPUlsIsqM0U4HL2F0VdDxob9Ws8AJSPKvJ9BLpO
haJyhWft1N5EbScefuK11qHOtPf8ZVWt0dl6DtNKoHtcX8GKkBVWkcn0EDQdCfHO
WhwAZFRuGM2NuLWo0qv7pQq42oy1iYC4rGPpV9hslDwxn4UzG6KjIS74qo9T4dw6
KwDwwrLfLPsObO2a1qEmL5l708nBaUi3VVv3HmL7ZRPQBdzlb297Se/FdDDtnECL
VM70BSDXUNJOIbmBItrEGmyS+0YYh8nl0445kxlbQ4yp52fu1Kh5Z/Uvw+cYlZRo
F9GPDiF/AgMBAAECggEAAc7WmszbVtmloBRM3tgPIPcyfweucCU38w+Or+qvVaC5
885gysls/uaVUl0AKm7K0gqxiOlsRF5h+cZaSHvY9AGv0CsWYLD5B/P8qJxsC04q
ABu7gpuYq3CTjpHnlGheCZqneYMYgnxiCA4VwP1PlhGGUOw2ZVHDCHsiZ37OQnjs
JuNfnaV6uJIdzSjDUv/5dVdPVqquGyWhzQgnWBGqcc/QTEFa9sd+ic8UDpXfmehI
PDxzBCWM5luL5cXmjM+0qEJnxO4v2/bUjHtlEabyhFg6VvPwLDkc2N+fx4reiSyj
ng4pI/V6U7mf4OF2bzoy0mvq1Gx6LuKcPR2FxgwWpQKBgQDfobj0+fqEnSTJpQIq
ORHp/acH2lsxZzOjdhQ6w9GmpwyfIqdG2VQykvFj/t8ekk6XxR/iJTGNSXJFXqCX
tk/xFddWbdn27dki+By/pIuBQ4XMvyicCh8N2BJUQqNmL0DHon0Sh5g5oBatrF+E
FrDXJk6YYSaffQMXKk3u5u+tzQKBgQDDBdNoq5pLJFZ3DH+7Igx/SzLc9XI78NNq
w7zS+fV1rrzAv+oCufqtZ8Q9V2/oLphWk1w3KYD4VBuRxq43Hncbw3gcEjxCaMeH
GWe1HQrE1HwvROL76QPGTTcnKOdlsUPF04XkvPqVrBoPkzbL2WEVvk51KK5bKqXE
kODuaNwgewKBgFhchz9Msp7JlKqUJ2nViO2CywfAUH4RwAabdlzN2L3XjZYnVB8b
ajhddUHEiBaFSsaPHgz2E0E3Pw6H2D55y9Z/gclluFToH/7AOGPEuVaG/owrD/mv
yhtnP77JYdTTYO5AltjGePBz/+H5lPgVGyS3vyBYarFj7N+vWIHH//YVAoGATOfb
OoeRTNiDkGbJaA5BR2FsKV5RMfoCJTQTHk+b0FCb9pa3vWOByygEZvw4ESNux5VM
5CPlzAe+53ml8e59oeEvWEKIqNeQ92G5V96gBIaWgj10FUsKRgTlHvguaBfDVhvX
zSAI4UUA8etnzHNoqZ5maiUkvKbQv/cx/FI1nEkCgYEAzWsjFLhZvYkbOKg0A4tz
9WSD4COHdd3IXezm30G+MWMQtDFLCK65i0sv7TjP+UTu1vvYMdvWwFFzgiz3rbn/
62vJHvsuqM4gCgv5LzDfnRPP5SO3rVjR9Hlx6rqGIxqiQDzVjqgcRNYZujxe5hc6
90iVYzKwGx5HQYzpOyvgL14=
-----END PRIVATE KEY-----`;

// Corresponding RSA public key
const TEST_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAql1GuPI/kfBY+Yf8vYkZ
lzeQ7F+BUQkNiaok+4kz1JbCLKjNFOBy9hdFXQ8aG/VrPACUjyryfQS6ToWicoVn
7dTeRG0nHn7itdahzrT3/GVVrdHZeg7TSqB7XF/BipAVVpHJ9BA0HQnxzlocAGRU
bhjNjbi1qNKr+6UKuNqMtYmAuKxj6VfYbJQ8MZ+FMxuioyEu+KqPU+HcOisA8MKy
3yz7DmztmtahJi+Ze9PJwWlIt1Vb9x5i+2UT0AXc5W9ve0nvxXQw7ZxAi1TO9AUg
11DSTiG5gSLaxBpskvtGGIfJ5dOOOZMZW0OMqedn7tSoeWf1L8PnGJWUaBfRjw4h
fwIDAQAB
-----END PUBLIC KEY-----`;

// Mock logger
const mockLogger: Logger = {
  error: jest.fn(),
  warn: jest.fn(),
  notice: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

describe("KeyManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize without keys", async () => {
      const km = new KeyManager({}, mockLogger);
      await km.init();

      expect(km.getSigningKey()).toBeNull();
      expect(km.getEncryptionKey()).toBeNull();
    });

    it("should initialize with RSA signing key", async () => {
      const km = new KeyManager(
        {
          oidcServicePrivateKeySig: TEST_RSA_PRIVATE_KEY,
          oidcServiceKeyIdSig: "test-key-id",
        },
        mockLogger,
      );
      await km.init();

      const signingKey = km.getSigningKey();
      expect(signingKey).not.toBeNull();
      expect(signingKey?.kid).toBe("test-key-id");
      expect(signingKey?.alg).toBe("RS256");
      expect(signingKey?.kty).toBe("RSA");
      expect(signingKey?.use).toBe("sig");
    });

    it("should generate key ID if not provided", async () => {
      const km = new KeyManager(
        {
          oidcServicePrivateKeySig: TEST_RSA_PRIVATE_KEY,
        },
        mockLogger,
      );
      await km.init();

      const signingKey = km.getSigningKey();
      expect(signingKey).not.toBeNull();
      expect(signingKey?.kid).toBeDefined();
      expect(signingKey?.kid.length).toBeGreaterThan(0);
    });

    it("should initialize only once", async () => {
      const km = new KeyManager(
        {
          oidcServicePrivateKeySig: TEST_RSA_PRIVATE_KEY,
        },
        mockLogger,
      );
      await km.init();
      await km.init(); // Second call should be no-op

      // Logger should only be called once
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
    });

    it("should log error for invalid key", async () => {
      const km = new KeyManager(
        {
          oidcServicePrivateKeySig: "invalid-key",
        },
        mockLogger,
      );
      await km.init();

      expect(km.getSigningKey()).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("JWKS generation", () => {
    it("should build JWKS with signing key", async () => {
      const km = new KeyManager(
        {
          oidcServicePrivateKeySig: TEST_RSA_PRIVATE_KEY,
          oidcServicePublicKeySig: TEST_RSA_PUBLIC_KEY,
          oidcServiceKeyIdSig: "sig-key-1",
        },
        mockLogger,
      );
      await km.init();

      const jwks = await km.buildJWKS();
      expect(jwks.keys).toHaveLength(1);
      expect(jwks.keys[0].kid).toBe("sig-key-1");
      expect(jwks.keys[0].use).toBe("sig");
      expect(jwks.keys[0].alg).toBe("RS256");
      expect(jwks.keys[0].kty).toBe("RSA");
      // Should have public key components
      expect(jwks.keys[0].n).toBeDefined();
      expect(jwks.keys[0].e).toBeDefined();
      // Should NOT have private key components
      expect(jwks.keys[0].d).toBeUndefined();
    });

    it("should build JWKS without public key config (extracts from private)", async () => {
      const km = new KeyManager(
        {
          oidcServicePrivateKeySig: TEST_RSA_PRIVATE_KEY,
          oidcServiceKeyIdSig: "sig-key-2",
        },
        mockLogger,
      );
      await km.init();

      const jwks = await km.buildJWKS();
      expect(jwks.keys).toHaveLength(1);
      expect(jwks.keys[0].kid).toBe("sig-key-2");
      expect(jwks.keys[0].n).toBeDefined();
      expect(jwks.keys[0].d).toBeUndefined();
    });

    it("should build empty JWKS without keys", async () => {
      const km = new KeyManager({}, mockLogger);
      await km.init();

      const jwks = await km.buildJWKS();
      expect(jwks.keys).toHaveLength(0);
    });
  });

  describe("JWT signing", () => {
    it("should sign JWT with RSA key", async () => {
      const km = new KeyManager(
        {
          oidcServicePrivateKeySig: TEST_RSA_PRIVATE_KEY,
          oidcServiceKeyIdSig: "test-key",
        },
        mockLogger,
      );
      await km.init();

      const payload = {
        iss: "https://example.com",
        sub: "user123",
        aud: "client123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = await km.signJWT(payload);
      expect(token).toBeDefined();
      expect(token.split(".")).toHaveLength(3);

      // Verify the token
      const result = await km.verifyJWT(token);
      expect(result.payload.iss).toBe("https://example.com");
      expect(result.payload.sub).toBe("user123");
    });

    it("should throw error when no signing key", async () => {
      const km = new KeyManager({}, mockLogger);
      await km.init();

      await expect(km.signJWT({ sub: "test" })).rejects.toThrow(
        "No signing key configured",
      );
    });

    it("should include custom headers", async () => {
      const km = new KeyManager(
        {
          oidcServicePrivateKeySig: TEST_RSA_PRIVATE_KEY,
          oidcServiceKeyIdSig: "test-key",
        },
        mockLogger,
      );
      await km.init();

      const token = await km.signJWT(
        { sub: "test" },
        {
          typ: "at+jwt",
          extraHeaders: { custom: "value" },
        },
      );

      // Decode header
      const [headerB64] = token.split(".");
      const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
      expect(header.typ).toBe("at+jwt");
      expect(header.custom).toBe("value");
      expect(header.kid).toBe("test-key");
    });
  });

  describe("JWT verification", () => {
    it("should verify JWT successfully", async () => {
      const km = new KeyManager(
        {
          oidcServicePrivateKeySig: TEST_RSA_PRIVATE_KEY,
          oidcServiceKeyIdSig: "test-key",
        },
        mockLogger,
      );
      await km.init();

      const now = Math.floor(Date.now() / 1000);
      const token = await km.signJWT({
        iss: "https://issuer.example.com",
        sub: "user456",
        aud: "client789",
        exp: now + 3600,
        iat: now,
      });

      const result = await km.verifyJWT(token, {
        issuer: "https://issuer.example.com",
        audience: "client789",
      });

      expect(result.payload.sub).toBe("user456");
    });

    it("should reject expired token", async () => {
      const km = new KeyManager(
        {
          oidcServicePrivateKeySig: TEST_RSA_PRIVATE_KEY,
        },
        mockLogger,
      );
      await km.init();

      const now = Math.floor(Date.now() / 1000);
      const token = await km.signJWT({
        sub: "test",
        exp: now - 3600, // Expired 1 hour ago
        iat: now - 7200,
      });

      await expect(km.verifyJWT(token)).rejects.toThrow();
    });
  });

  describe("HMAC signing", () => {
    it("should sign with client secret (HS256)", async () => {
      const km = new KeyManager({}, mockLogger);
      await km.init();

      const secret = "my-super-secret-client-secret-that-is-long-enough";
      const payload = {
        iss: "https://example.com",
        sub: "user123",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const token = await km.signWithSecret(payload, secret, "HS256");
      expect(token).toBeDefined();
      expect(token.split(".")).toHaveLength(3);

      // Decode header to verify algorithm
      const [headerB64] = token.split(".");
      const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
      expect(header.alg).toBe("HS256");
    });

    it("should support different HMAC algorithms", async () => {
      const km = new KeyManager({}, mockLogger);
      await km.init();

      const secret = "my-super-secret-client-secret-that-is-long-enough";

      for (const alg of ["HS256", "HS384", "HS512"] as const) {
        const token = await km.signWithSecret({ sub: "test" }, secret, alg);
        const [headerB64] = token.split(".");
        const header = JSON.parse(
          Buffer.from(headerB64, "base64url").toString(),
        );
        expect(header.alg).toBe(alg);
      }
    });
  });

  describe("createSecretKey", () => {
    it("should create symmetric key from secret", async () => {
      const km = new KeyManager({}, mockLogger);
      await km.init();

      const key = await km.createSecretKey("test-secret");
      expect(key).toBeDefined();
    });
  });
});
