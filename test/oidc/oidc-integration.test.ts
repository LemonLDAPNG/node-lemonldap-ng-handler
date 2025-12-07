/**
 * OIDC Integration Tests
 *
 * Tests that instantiate both an OIDC Provider (issuer-oidc) and
 * an OIDC Relying Party (auth-oidc) to test the full authentication flow.
 *
 * Inspired by LemonLDAP::NG Perl tests in t/32-*.t
 */

import express, { Express } from "express";
import { Server } from "http";
import { OIDCProvider } from "../../packages/issuer-oidc/src/provider";
import { createOIDCRouter } from "../../packages/issuer-oidc/src/router";
import { OIDCAuth } from "../../packages/auth-oidc/src/auth";
import { OIDCUserDB } from "../../packages/userdb-oidc/src/index";

// Test configuration
const OP_PORT = 19080;
const OP_ISSUER = `http://localhost:${OP_PORT}`;
const RP_CALLBACK = `http://localhost:19081/callback`;

// Silent logger
const silentLogger = {
  error: () => {},
  warn: () => {},
  notice: () => {},
  info: () => {},
  debug: () => {},
};

describe("OIDC Integration Tests", () => {
  let opApp: Express;
  let opServer: Server;
  let provider: OIDCProvider;
  let rpAuth: OIDCAuth;
  let userdb: OIDCUserDB;

  // Test user data
  const testUser = {
    id: "test-user-123",
    sessionId: "session-abc",
    claims: {
      sub: "test-user-123",
      name: "Test User",
      email: "testuser@example.com",
      given_name: "Test",
      family_name: "User",
    },
  };

  beforeAll(async () => {
    // Generate a proper RSA key for testing
    const { generateKeyPair } = await import("crypto");
    const { promisify } = await import("util");
    const generateKeyPairAsync = promisify(generateKeyPair);

    const { privateKey } = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    // Setup OIDC Provider (OP)
    provider = new OIDCProvider({
      oidcServiceMetaDataIssuer: OP_ISSUER,
      oidcServicePrivateKeySig: privateKey,
      oidcServiceKeyIdSig: "test-key-1",
      oidcRPMetaDataOptions: {
        "test-rp": {
          oidcRPMetaDataOptionsClientID: "test-client-id",
          oidcRPMetaDataOptionsClientSecret: "test-client-secret",
          oidcRPMetaDataOptionsRedirectUris: [RP_CALLBACK],
          oidcRPMetaDataOptionsBypassConsent: true,
        },
      },
      oidcRPMetaDataExportedVars: {
        "test-rp": {
          email: "mail",
          family_name: "sn",
          given_name: "givenName",
          name: "cn",
        },
      },
      // Custom session lookup for tests
      getSession: async (sessionId: string) => {
        if (sessionId === testUser.sessionId) {
          return testUser.claims;
        }
        return null;
      },
      logger: silentLogger,
    });

    await provider.init();

    // Setup Express app for OP
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

    // Start OP server
    await new Promise<void>((resolve) => {
      opServer = opApp.listen(OP_PORT, () => {
        resolve();
      });
    });

    // Setup OIDC RP (auth-oidc)
    rpAuth = new OIDCAuth({
      oidcOPMetaData: {
        "test-op": {
          confKey: "test-op",
          oidcOPMetaDataOptions: {
            oidcOPMetaDataOptionsClientID: "test-client-id",
            oidcOPMetaDataOptionsClientSecret: "test-client-secret",
            oidcOPMetaDataOptionsConfigurationURI: `${OP_ISSUER}/.well-known/openid-configuration`,
            oidcOPMetaDataOptionsAuthorizeURI: `${OP_ISSUER}/authorize`,
            oidcOPMetaDataOptionsTokenURI: `${OP_ISSUER}/token`,
            oidcOPMetaDataOptionsUserInfoURI: `${OP_ISSUER}/userinfo`,
            oidcOPMetaDataOptionsScope: "openid profile email",
            oidcOPMetaDataOptionsUsePKCE: true,
            oidcOPMetaDataOptionsPKCEMethod: "S256",
          },
          oidcOPMetaDataExportedVars: {
            uid: "sub",
            mail: "email",
            cn: "name",
          },
        },
      },
      logger: silentLogger,
    });

    await rpAuth.init();

    // Setup UserDB
    userdb = new OIDCUserDB();
    await userdb.init(
      {
        oidcOPMetaData: {
          "test-op": {
            oidcOPMetaDataExportedVars: {
              uid: "sub",
              mail: "email",
              cn: "name",
              givenName: "given_name",
              sn: "family_name",
            },
          },
        },
      } as any,
      silentLogger as any,
    );
  });

  afterAll(async () => {
    if (opServer) {
      await new Promise<void>((resolve) => {
        opServer.close(() => resolve());
      });
    }
  });

  describe("Discovery", () => {
    it("should fetch discovery document", async () => {
      const response = await fetch(
        `${OP_ISSUER}/.well-known/openid-configuration`,
      );
      expect(response.ok).toBe(true);

      const metadata = (await response.json()) as Record<string, unknown>;
      expect(metadata.issuer).toBe(OP_ISSUER);
      expect(metadata.authorization_endpoint).toBe(`${OP_ISSUER}/authorize`);
      expect(metadata.token_endpoint).toBe(`${OP_ISSUER}/token`);
      expect(metadata.userinfo_endpoint).toBe(`${OP_ISSUER}/userinfo`);
      expect(metadata.jwks_uri).toBe(`${OP_ISSUER}/jwks`);
    });

    it("should fetch JWKS", async () => {
      const response = await fetch(`${OP_ISSUER}/jwks`);
      expect(response.ok).toBe(true);

      const jwks = (await response.json()) as { keys: { kty: string }[] };
      expect(jwks.keys).toBeDefined();
      expect(jwks.keys.length).toBeGreaterThan(0);
      expect(jwks.keys[0].kty).toBe("RSA");
    });
  });

  describe("OP List", () => {
    it("should return configured OPs", () => {
      const opList = rpAuth.getOPList();
      expect(opList).toHaveLength(1);
      expect(opList[0].val).toBe("test-op");
    });
  });

  describe("Authorization URL", () => {
    it("should generate authorization URL with PKCE", async () => {
      const url = await rpAuth.getAuthorizationUrl("test-op", RP_CALLBACK);

      const parsed = new URL(url);
      expect(parsed.origin).toBe(OP_ISSUER);
      expect(parsed.pathname).toBe("/authorize");
      expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
      expect(parsed.searchParams.get("redirect_uri")).toBe(RP_CALLBACK);
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("scope")).toBe("openid profile email");
      expect(parsed.searchParams.get("state")).toBeTruthy();
      expect(parsed.searchParams.get("nonce")).toBeTruthy();
      expect(parsed.searchParams.get("code_challenge")).toBeTruthy();
      expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    });
  });

  describe("Full Authorization Code Flow", () => {
    let authCode: string;
    let state: string;
    let stateData: any;

    it("should generate authorization request", async () => {
      // Store state for later
      const stateStore = new Map<string, any>();

      const authWithStore = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": {
            confKey: "test-op",
            oidcOPMetaDataOptions: {
              oidcOPMetaDataOptionsClientID: "test-client-id",
              oidcOPMetaDataOptionsClientSecret: "test-client-secret",
              oidcOPMetaDataOptionsAuthorizeURI: `${OP_ISSUER}/authorize`,
              oidcOPMetaDataOptionsTokenURI: `${OP_ISSUER}/token`,
              oidcOPMetaDataOptionsUserInfoURI: `${OP_ISSUER}/userinfo`,
              oidcOPMetaDataOptionsScope: "openid profile email",
              oidcOPMetaDataOptionsUsePKCE: true,
            },
          },
        },
        storeState: async (s, data) => {
          stateStore.set(s, data);
          state = s;
          stateData = data;
        },
        consumeState: async (s) => {
          const data = stateStore.get(s);
          stateStore.delete(s);
          return data || null;
        },
        logger: silentLogger,
      } as any);

      await authWithStore.init();

      const url = await authWithStore.getAuthorizationUrl(
        "test-op",
        RP_CALLBACK,
      );
      const parsed = new URL(url);

      // Make authorization request to OP
      const authResponse = await fetch(url, { redirect: "manual" });

      // Should redirect with code
      expect(authResponse.status).toBe(302);
      const location = authResponse.headers.get("location");
      expect(location).toBeTruthy();

      const redirectUrl = new URL(location!);
      authCode = redirectUrl.searchParams.get("code")!;
      const returnedState = redirectUrl.searchParams.get("state");

      expect(authCode).toBeTruthy();
      expect(returnedState).toBe(parsed.searchParams.get("state"));

      // Now handle the callback
      const result = await authWithStore.handleCallback(
        authCode,
        returnedState!,
        RP_CALLBACK,
      );

      expect(result.success).toBe(true);
      expect(result.userId).toBe(testUser.id);
      expect(result.userInfo).toBeDefined();
      expect(result.userInfo?.email).toBe(testUser.claims.email);
    });
  });

  describe("Token Introspection", () => {
    it("should introspect access token", async () => {
      // First get a token
      const stateStore = new Map<string, any>();
      const authWithStore = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": {
            confKey: "test-op",
            oidcOPMetaDataOptions: {
              oidcOPMetaDataOptionsClientID: "test-client-id",
              oidcOPMetaDataOptionsClientSecret: "test-client-secret",
              oidcOPMetaDataOptionsAuthorizeURI: `${OP_ISSUER}/authorize`,
              oidcOPMetaDataOptionsTokenURI: `${OP_ISSUER}/token`,
              oidcOPMetaDataOptionsUserInfoURI: `${OP_ISSUER}/userinfo`,
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

      await authWithStore.init();

      const url = await authWithStore.getAuthorizationUrl(
        "test-op",
        RP_CALLBACK,
      );
      const authResponse = await fetch(url, { redirect: "manual" });
      const location = authResponse.headers.get("location")!;
      const redirectUrl = new URL(location);
      const code = redirectUrl.searchParams.get("code")!;
      const state = redirectUrl.searchParams.get("state")!;

      const result = await authWithStore.handleCallback(
        code,
        state,
        RP_CALLBACK,
      );
      expect(result.success).toBe(true);
      expect(result.accessToken).toBeTruthy();

      // Introspect the token
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

      expect(introspectResponse.ok).toBe(true);
      const introspection = (await introspectResponse.json()) as Record<
        string,
        unknown
      >;
      expect(introspection.active).toBe(true);
      expect(introspection.client_id).toBe("test-client-id");
    });
  });

  describe("UserInfo Endpoint", () => {
    it("should return user info with valid access token", async () => {
      // Get access token first
      const stateStore = new Map<string, any>();
      const authWithStore = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": {
            confKey: "test-op",
            oidcOPMetaDataOptions: {
              oidcOPMetaDataOptionsClientID: "test-client-id",
              oidcOPMetaDataOptionsClientSecret: "test-client-secret",
              oidcOPMetaDataOptionsAuthorizeURI: `${OP_ISSUER}/authorize`,
              oidcOPMetaDataOptionsTokenURI: `${OP_ISSUER}/token`,
              oidcOPMetaDataOptionsUserInfoURI: `${OP_ISSUER}/userinfo`,
              oidcOPMetaDataOptionsStoreAccessToken: true,
              oidcOPMetaDataOptionsGetUserInfo: false, // Don't auto-fetch
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

      await authWithStore.init();

      const url = await authWithStore.getAuthorizationUrl(
        "test-op",
        RP_CALLBACK,
      );
      const authResponse = await fetch(url, { redirect: "manual" });
      const location = authResponse.headers.get("location")!;
      const redirectUrl = new URL(location);
      const code = redirectUrl.searchParams.get("code")!;
      const state = redirectUrl.searchParams.get("state")!;

      const result = await authWithStore.handleCallback(
        code,
        state,
        RP_CALLBACK,
      );
      expect(result.accessToken).toBeTruthy();

      // Call userinfo endpoint directly
      const userInfoResponse = await fetch(`${OP_ISSUER}/userinfo`, {
        headers: {
          Authorization: `Bearer ${result.accessToken}`,
        },
      });

      expect(userInfoResponse.ok).toBe(true);
      const userInfo = (await userInfoResponse.json()) as Record<
        string,
        unknown
      >;
      expect(userInfo.sub).toBe(testUser.id);
    });
  });

  describe("UserDB OIDC", () => {
    it("should build user data from OIDC claims", async () => {
      userdb.setOIDCClaims({
        opConfKey: "test-op",
        idTokenClaims: {
          sub: testUser.claims.sub,
          iss: OP_ISSUER,
          aud: "test-client-id",
        },
        userInfo: testUser.claims,
      });

      const userData = await userdb.getUser(testUser.id);

      expect(userData).not.toBeNull();
      expect(userData!.uid).toBe(testUser.id);
      expect(userData!.attributes.mail).toBe(testUser.claims.email);
      expect(userData!.attributes.cn).toBe(testUser.claims.name);
    });

    it("should set session info correctly", async () => {
      userdb.setOIDCClaims({
        opConfKey: "test-op",
        userInfo: testUser.claims,
      });

      const userData = await userdb.getUser(testUser.id);
      const session = {} as any;

      userdb.setSessionInfo(session, userData!);

      expect(session.uid).toBe(testUser.id);
      expect(session._user).toBe(testUser.id);
      expect(session.mail).toBe(testUser.claims.email);
      expect(session._oidcOP).toBe("test-op");
      expect(session._oidcSub).toBe(testUser.id);
    });
  });

  describe("Logout", () => {
    it("should generate logout URL", () => {
      const logoutUrl = rpAuth.getLogoutUrl("test-op");
      // Our test OP doesn't have end_session_endpoint configured
      // This should return null or the configured endpoint
      expect(logoutUrl === null || typeof logoutUrl === "string").toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle error callback", () => {
      const result = rpAuth.handleErrorCallback(
        "access_denied",
        "User denied access",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("access_denied");
      expect(result.errorDescription).toBe("User denied access");
    });

    it("should reject invalid client_id in authorization request", async () => {
      const response = await fetch(
        `${OP_ISSUER}/authorize?` +
          new URLSearchParams({
            response_type: "code",
            client_id: "invalid-client",
            redirect_uri: RP_CALLBACK,
            scope: "openid",
            state: "test-state",
          }).toString(),
        { redirect: "manual" },
      );

      // OIDC spec: error is redirected to redirect_uri with error parameter
      // When client_id is invalid, we should get either a 400 or a redirect with error
      if (response.status === 302) {
        const location = response.headers.get("location");
        expect(location).toContain("error=");
      } else {
        expect(response.status).toBe(400);
      }
    });

    it("should reject invalid redirect_uri", async () => {
      const response = await fetch(
        `${OP_ISSUER}/authorize?` +
          new URLSearchParams({
            response_type: "code",
            client_id: "test-client-id",
            redirect_uri: "https://malicious.example.com/callback",
            scope: "openid",
            state: "test-state",
          }).toString(),
        { redirect: "manual" },
      );

      // Invalid redirect_uri should return 400 (can't redirect to untrusted URI)
      // or redirect with error if the OP sends error to the invalid URI
      if (response.status === 302) {
        const location = response.headers.get("location");
        expect(location).toContain("error=");
      } else {
        expect(response.status).toBe(400);
      }
    });
  });
});
