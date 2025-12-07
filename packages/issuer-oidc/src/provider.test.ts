/**
 * Tests for OIDC Provider
 */

import { OIDCProvider } from "./provider";
import { OIDCProviderConfig, AuthorizationRequest } from "./types";

// Test RSA private key (PKCS#8 format)
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
const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  notice: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

describe("OIDCProvider", () => {
  let provider: OIDCProvider;
  let config: OIDCProviderConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    config = {
      oidcServiceMetaDataIssuer: "https://auth.example.com",
      oidcServicePrivateKeySig: TEST_RSA_PRIVATE_KEY,
      oidcServicePublicKeySig: TEST_RSA_PUBLIC_KEY,
      oidcServiceKeyIdSig: "test-key",
      oidcServiceAllowAuthorizationCodeFlow: true,
      oidcRPMetaDataOptions: {
        testClient: {
          oidcRPMetaDataOptionsClientID: "test-client-id",
          oidcRPMetaDataOptionsClientSecret: "test-client-secret",
          oidcRPMetaDataOptionsRedirectUris: [
            "https://app.example.com/callback",
          ],
        },
        publicClient: {
          oidcRPMetaDataOptionsClientID: "public-client-id",
          oidcRPMetaDataOptionsPublic: true,
          oidcRPMetaDataOptionsRedirectUris: [
            "https://spa.example.com/callback",
          ],
          oidcRPMetaDataOptionsRequirePKCE: true,
        },
      },
      logger: mockLogger,
    };

    provider = new OIDCProvider(config);
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      await provider.init();
      expect(mockLogger.info).toHaveBeenCalledWith("OIDC Provider initialized");
    });

    it("should return correct issuer", () => {
      expect(provider.getIssuer()).toBe("https://auth.example.com");
    });
  });

  describe("getRP", () => {
    it("should find RP by client_id", () => {
      const rp = provider.getRP("test-client-id");
      expect(rp).not.toBeNull();
      expect(rp?.oidcRPMetaDataOptionsClientID).toBe("test-client-id");
    });

    it("should return null for unknown client_id", () => {
      const rp = provider.getRP("unknown-client");
      expect(rp).toBeNull();
    });
  });

  describe("discovery metadata", () => {
    it("should generate valid discovery metadata", () => {
      const metadata = provider.getDiscoveryMetadata();

      expect(metadata.issuer).toBe("https://auth.example.com");
      expect(metadata.authorization_endpoint).toBe(
        "https://auth.example.com/authorize",
      );
      expect(metadata.token_endpoint).toBe("https://auth.example.com/token");
      expect(metadata.userinfo_endpoint).toBe(
        "https://auth.example.com/userinfo",
      );
      expect(metadata.jwks_uri).toBe("https://auth.example.com/jwks");
    });

    it("should include code in response_types_supported when code flow is enabled", () => {
      const metadata = provider.getDiscoveryMetadata();
      expect(metadata.response_types_supported).toContain("code");
    });

    it("should include PKCE support", () => {
      const metadata = provider.getDiscoveryMetadata();
      expect(metadata.code_challenge_methods_supported).toEqual([
        "S256",
        "plain",
      ]);
    });
  });

  describe("JWKS", () => {
    it("should return JWKS with signing key", async () => {
      await provider.init();
      const jwks = await provider.getJWKS();

      expect(jwks.keys).toHaveLength(1);
      const key = jwks.keys[0] as Record<string, unknown>;
      expect(key.kid).toBe("test-key");
      expect(key.use).toBe("sig");
    });
  });

  describe("authorization request validation", () => {
    it("should reject missing client_id", () => {
      const error = provider.validateAuthorizationRequest({
        response_type: "code",
        redirect_uri: "https://app.example.com/callback",
      } as AuthorizationRequest);

      expect(error).not.toBeNull();
      expect(error?.error).toBe("invalid_request");
    });

    it("should reject unknown client_id", () => {
      const error = provider.validateAuthorizationRequest({
        response_type: "code",
        client_id: "unknown",
        redirect_uri: "https://app.example.com/callback",
      });

      expect(error?.error).toBe("unauthorized_client");
    });

    it("should reject invalid redirect_uri", () => {
      const error = provider.validateAuthorizationRequest({
        response_type: "code",
        client_id: "test-client-id",
        redirect_uri: "https://evil.com/callback",
      });

      expect(error?.error).toBe("invalid_request");
      expect(error?.error_description).toContain("redirect_uri");
    });

    it("should accept valid authorization request", () => {
      const error = provider.validateAuthorizationRequest({
        response_type: "code",
        client_id: "test-client-id",
        redirect_uri: "https://app.example.com/callback",
        scope: "openid profile",
      });

      expect(error).toBeNull();
    });

    it("should require PKCE for clients with requirePKCE", () => {
      const error = provider.validateAuthorizationRequest({
        response_type: "code",
        client_id: "public-client-id",
        redirect_uri: "https://spa.example.com/callback",
        scope: "openid",
      });

      expect(error?.error).toBe("invalid_request");
      expect(error?.error_description).toContain("PKCE");
    });

    it("should accept request with PKCE", () => {
      const error = provider.validateAuthorizationRequest({
        response_type: "code",
        client_id: "public-client-id",
        redirect_uri: "https://spa.example.com/callback",
        scope: "openid",
        code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        code_challenge_method: "S256",
      });

      expect(error).toBeNull();
    });
  });

  describe("authorization code flow", () => {
    it("should generate authorization code", async () => {
      await provider.init();

      const request: AuthorizationRequest = {
        response_type: "code",
        client_id: "test-client-id",
        redirect_uri: "https://app.example.com/callback",
        scope: "openid profile",
        nonce: "test-nonce",
        state: "test-state",
      };

      const code = await provider.generateAuthorizationCode(
        request,
        "user123",
        "session456",
      );

      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(20);
    });
  });

  describe("token endpoint", () => {
    it("should exchange authorization code for tokens", async () => {
      await provider.init();

      // First, generate an authorization code
      const request: AuthorizationRequest = {
        response_type: "code",
        client_id: "test-client-id",
        redirect_uri: "https://app.example.com/callback",
        scope: "openid",
        nonce: "test-nonce",
      };

      const code = await provider.generateAuthorizationCode(
        request,
        "user123",
        "session456",
      );

      // Then exchange the code for tokens
      const tokenResponse = await provider.handleTokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://app.example.com/callback",
        client_id: "test-client-id",
        client_secret: "test-client-secret",
      });

      expect("error" in tokenResponse).toBe(false);
      if (!("error" in tokenResponse)) {
        expect(tokenResponse.access_token).toBeDefined();
        expect(tokenResponse.id_token).toBeDefined();
        expect(tokenResponse.token_type).toBe("Bearer");
      }
    });

    it("should reject invalid authorization code", async () => {
      await provider.init();

      const tokenResponse = await provider.handleTokenRequest({
        grant_type: "authorization_code",
        code: "invalid-code",
        redirect_uri: "https://app.example.com/callback",
        client_id: "test-client-id",
        client_secret: "test-client-secret",
      });

      expect("error" in tokenResponse).toBe(true);
      if ("error" in tokenResponse) {
        expect(tokenResponse.error).toBe("invalid_grant");
      }
    });

    it("should reject wrong client_secret", async () => {
      await provider.init();

      const request: AuthorizationRequest = {
        response_type: "code",
        client_id: "test-client-id",
        redirect_uri: "https://app.example.com/callback",
        scope: "openid",
      };

      const code = await provider.generateAuthorizationCode(
        request,
        "user123",
        "session456",
      );

      const tokenResponse = await provider.handleTokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://app.example.com/callback",
        client_id: "test-client-id",
        client_secret: "wrong-secret",
      });

      expect("error" in tokenResponse).toBe(true);
      if ("error" in tokenResponse) {
        expect(tokenResponse.error).toBe("invalid_client");
      }
    });

    it("should validate PKCE code_verifier", async () => {
      await provider.init();

      const codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

      const request: AuthorizationRequest = {
        response_type: "code",
        client_id: "public-client-id",
        redirect_uri: "https://spa.example.com/callback",
        scope: "openid",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      };

      const code = await provider.generateAuthorizationCode(
        request,
        "user123",
        "session456",
      );

      // With correct code_verifier
      const tokenResponse = await provider.handleTokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://spa.example.com/callback",
        client_id: "public-client-id",
        code_verifier: codeVerifier,
      });

      expect("error" in tokenResponse).toBe(false);
    });

    it("should reject wrong code_verifier", async () => {
      await provider.init();

      const codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

      const request: AuthorizationRequest = {
        response_type: "code",
        client_id: "public-client-id",
        redirect_uri: "https://spa.example.com/callback",
        scope: "openid",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      };

      const code = await provider.generateAuthorizationCode(
        request,
        "user123",
        "session456",
      );

      const tokenResponse = await provider.handleTokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://spa.example.com/callback",
        client_id: "public-client-id",
        code_verifier: "wrong-verifier",
      });

      expect("error" in tokenResponse).toBe(true);
      if ("error" in tokenResponse) {
        expect(tokenResponse.error).toBe("invalid_grant");
      }
    });
  });

  describe("introspection", () => {
    it("should introspect valid access token", async () => {
      await provider.init();

      // Generate tokens
      const request: AuthorizationRequest = {
        response_type: "code",
        client_id: "test-client-id",
        redirect_uri: "https://app.example.com/callback",
        scope: "openid profile",
      };

      const code = await provider.generateAuthorizationCode(
        request,
        "user123",
        "session456",
      );
      const tokenResponse = await provider.handleTokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://app.example.com/callback",
        client_id: "test-client-id",
        client_secret: "test-client-secret",
      });

      if (!("error" in tokenResponse)) {
        const introspection = await provider.handleIntrospectionRequest(
          tokenResponse.access_token,
        );

        expect(introspection.active).toBe(true);
        expect(introspection.client_id).toBe("test-client-id");
        expect(introspection.sub).toBe("user123");
      }
    });

    it("should return inactive for invalid token", async () => {
      await provider.init();

      const introspection =
        await provider.handleIntrospectionRequest("invalid-token");
      expect(introspection.active).toBe(false);
    });
  });

  describe("revocation", () => {
    it("should revoke access token", async () => {
      await provider.init();

      // Generate tokens
      const request: AuthorizationRequest = {
        response_type: "code",
        client_id: "test-client-id",
        redirect_uri: "https://app.example.com/callback",
        scope: "openid",
      };

      const code = await provider.generateAuthorizationCode(
        request,
        "user123",
        "session456",
      );
      const tokenResponse = await provider.handleTokenRequest({
        grant_type: "authorization_code",
        code,
        redirect_uri: "https://app.example.com/callback",
        client_id: "test-client-id",
        client_secret: "test-client-secret",
      });

      if (!("error" in tokenResponse)) {
        // Revoke the token
        await provider.handleRevocationRequest(tokenResponse.access_token);

        // Verify it's revoked
        const introspection = await provider.handleIntrospectionRequest(
          tokenResponse.access_token,
        );
        expect(introspection.active).toBe(false);
      }
    });
  });
});
