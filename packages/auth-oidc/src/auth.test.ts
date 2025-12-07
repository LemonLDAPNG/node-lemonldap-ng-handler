/**
 * Tests for OIDC Auth (Relying Party) module
 */

import { OIDCAuth } from "./auth";
import { OIDCAuthConfig, OIDCOPConfig } from "./types";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Test OP configuration
const testOP: OIDCOPConfig = {
  confKey: "test-op",
  oidcOPMetaDataOptions: {
    oidcOPMetaDataOptionsClientID: "test-client-id",
    oidcOPMetaDataOptionsClientSecret: "test-client-secret",
    oidcOPMetaDataOptionsAuthorizeURI: "https://op.example.com/authorize",
    oidcOPMetaDataOptionsTokenURI: "https://op.example.com/token",
    oidcOPMetaDataOptionsUserInfoURI: "https://op.example.com/userinfo",
    oidcOPMetaDataOptionsEndSessionURI: "https://op.example.com/logout",
    oidcOPMetaDataOptionsDisplayName: "Test OP",
    oidcOPMetaDataOptionsSortNumber: 1,
  },
  oidcOPMetaDataExportedVars: {
    uid: "sub",
    mail: "email",
    cn: "name",
  },
};

const testOP2: OIDCOPConfig = {
  confKey: "test-op-2",
  oidcOPMetaDataOptions: {
    oidcOPMetaDataOptionsClientID: "test-client-id-2",
    oidcOPMetaDataOptionsAuthorizeURI: "https://op2.example.com/authorize",
    oidcOPMetaDataOptionsTokenURI: "https://op2.example.com/token",
    oidcOPMetaDataOptionsDisplayName: "Test OP 2",
    oidcOPMetaDataOptionsSortNumber: 2,
    oidcOPMetaDataOptionsUsePKCE: true,
    oidcOPMetaDataOptionsPKCEMethod: "S256",
  },
};

// Silent logger for tests
const silentLogger = {
  error: () => {},
  warn: () => {},
  notice: () => {},
  info: () => {},
  debug: () => {},
};

describe("OIDCAuth", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("constructor", () => {
    it("should create instance with minimal config", () => {
      const auth = new OIDCAuth({
        logger: silentLogger,
      });
      expect(auth).toBeDefined();
    });

    it("should create instance with OP configuration", () => {
      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": testOP,
        },
        logger: silentLogger,
      });
      expect(auth).toBeDefined();
    });
  });

  describe("init", () => {
    it("should initialize without OPs", async () => {
      const auth = new OIDCAuth({
        logger: silentLogger,
      });
      await auth.init();
    });

    it("should initialize with configured OPs", async () => {
      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": testOP,
        },
        logger: silentLogger,
      });
      await auth.init();
    });

    it("should be idempotent", async () => {
      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": testOP,
        },
        logger: silentLogger,
      });
      await auth.init();
      await auth.init(); // Should not throw
    });
  });

  describe("getOPList", () => {
    it("should return empty list when no OPs configured", () => {
      const auth = new OIDCAuth({
        logger: silentLogger,
      });
      expect(auth.getOPList()).toEqual([]);
    });

    it("should return list of OPs sorted by order", () => {
      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": testOP,
          "test-op-2": testOP2,
        },
        logger: silentLogger,
      });

      const list = auth.getOPList();
      expect(list).toHaveLength(2);
      expect(list[0].val).toBe("test-op");
      expect(list[0].name).toBe("Test OP");
      expect(list[0].order).toBe(1);
      expect(list[1].val).toBe("test-op-2");
    });
  });

  describe("getAuthorizationUrl", () => {
    let auth: OIDCAuth;
    const config: OIDCAuthConfig = {
      oidcOPMetaData: {
        "test-op": testOP,
        "test-op-2": testOP2,
      },
      logger: silentLogger,
    };

    beforeEach(async () => {
      auth = new OIDCAuth(config);
      await auth.init();
    });

    it("should throw for unknown OP", async () => {
      await expect(
        auth.getAuthorizationUrl(
          "unknown-op",
          "https://portal.example.com/callback",
        ),
      ).rejects.toThrow("Unknown OP: unknown-op");
    });

    it("should generate authorization URL with required parameters", async () => {
      const url = await auth.getAuthorizationUrl(
        "test-op",
        "https://portal.example.com/callback",
      );

      const parsed = new URL(url);
      expect(parsed.origin).toBe("https://op.example.com");
      expect(parsed.pathname).toBe("/authorize");
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("client_id")).toBe("test-client-id");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        "https://portal.example.com/callback",
      );
      expect(parsed.searchParams.get("scope")).toBe("openid profile email");
      expect(parsed.searchParams.get("state")).toBeTruthy();
      expect(parsed.searchParams.get("nonce")).toBeTruthy();
    });

    it("should generate authorization URL with PKCE", async () => {
      const url = await auth.getAuthorizationUrl(
        "test-op-2",
        "https://portal.example.com/callback",
      );

      const parsed = new URL(url);
      expect(parsed.searchParams.get("code_challenge")).toBeTruthy();
      expect(parsed.searchParams.get("code_challenge_method")).toBe("S256");
    });

    it("should store state data", async () => {
      let storedState: string | null = null;
      let storedData: unknown = null;

      const authWithStore = new OIDCAuth({
        ...config,
        storeState: async (state, data) => {
          storedState = state;
          storedData = data;
        },
      });
      await authWithStore.init();

      const url = await authWithStore.getAuthorizationUrl(
        "test-op",
        "https://portal.example.com/callback",
        "https://app.example.com/original",
      );

      const parsed = new URL(url);
      expect(storedState).toBe(parsed.searchParams.get("state"));
      expect(storedData).toMatchObject({
        op: "test-op",
        urldc: "https://app.example.com/original",
      });
    });
  });

  describe("handleCallback", () => {
    let auth: OIDCAuth;
    let stateStore: Map<string, unknown>;

    const config: OIDCAuthConfig = {
      oidcOPMetaData: {
        "test-op": testOP,
      },
      logger: silentLogger,
    };

    beforeEach(async () => {
      stateStore = new Map();

      auth = new OIDCAuth({
        ...config,
        storeState: async (state, data) => {
          stateStore.set(state, data);
        },
        consumeState: async (state) => {
          const data = stateStore.get(state);
          if (data) {
            stateStore.delete(state);
            return data as any;
          }
          return null;
        },
      });
      await auth.init();
    });

    it("should return error for invalid state", async () => {
      const result = await auth.handleCallback(
        "auth-code",
        "invalid-state",
        "https://portal.example.com/callback",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("invalid_state");
    });

    it("should return error for expired state", async () => {
      // Store an expired state
      stateStore.set("expired-state", {
        op: "test-op",
        createdAt: Math.floor(Date.now() / 1000) - 700,
        expiresAt: Math.floor(Date.now() / 1000) - 100,
      });

      const result = await auth.handleCallback(
        "auth-code",
        "expired-state",
        "https://portal.example.com/callback",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("invalid_state");
      expect(result.errorDescription).toContain("expired");
    });

    it("should exchange code for tokens successfully", async () => {
      // Create valid state
      const state = "valid-state-123";
      stateStore.set(state, {
        op: "test-op",
        nonce: "test-nonce",
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 600,
      });

      // Mock token response
      const idTokenPayload = {
        iss: "https://op.example.com",
        sub: "user123",
        aud: "test-client-id",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        nonce: "test-nonce",
        email: "user@example.com",
        name: "Test User",
      };

      const idToken = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify(idTokenPayload)).toString("base64url")}.signature`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-access-token",
          id_token: idToken,
          token_type: "Bearer",
          expires_in: 3600,
        }),
      });

      // Mock userinfo response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: "user123",
          email: "user@example.com",
          name: "Test User",
        }),
      });

      const result = await auth.handleCallback(
        "auth-code",
        state,
        "https://portal.example.com/callback",
      );

      expect(result.success).toBe(true);
      expect(result.userId).toBe("user123");
      expect(result.userInfo).toMatchObject({
        sub: "user123",
        email: "user@example.com",
      });
    });

    it("should validate nonce", async () => {
      const state = "valid-state-nonce";
      stateStore.set(state, {
        op: "test-op",
        nonce: "expected-nonce",
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 600,
      });

      // ID token with wrong nonce
      const idTokenPayload = {
        sub: "user123",
        nonce: "wrong-nonce",
      };

      const idToken = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify(idTokenPayload)).toString("base64url")}.signature`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-access-token",
          id_token: idToken,
          token_type: "Bearer",
        }),
      });

      const result = await auth.handleCallback(
        "auth-code",
        state,
        "https://portal.example.com/callback",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("invalid_token");
      expect(result.errorDescription).toContain("Nonce mismatch");
    });
  });

  describe("handleErrorCallback", () => {
    it("should return error result", () => {
      const auth = new OIDCAuth({
        logger: silentLogger,
      });

      const result = auth.handleErrorCallback(
        "access_denied",
        "User cancelled",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("access_denied");
      expect(result.errorDescription).toBe("User cancelled");
    });
  });

  describe("getLogoutUrl", () => {
    let auth: OIDCAuth;

    beforeEach(async () => {
      auth = new OIDCAuth({
        oidcOPMetaData: {
          "test-op": testOP,
          "test-op-2": testOP2, // No end_session_endpoint
        },
        logger: silentLogger,
      });
      await auth.init();
    });

    it("should return null for unknown OP", () => {
      const url = auth.getLogoutUrl("unknown-op");
      expect(url).toBeNull();
    });

    it("should return null when no end_session_endpoint", () => {
      const url = auth.getLogoutUrl("test-op-2");
      expect(url).toBeNull();
    });

    it("should generate logout URL", () => {
      const url = auth.getLogoutUrl("test-op");
      expect(url).toBe("https://op.example.com/logout");
    });

    it("should include id_token_hint", () => {
      const url = auth.getLogoutUrl("test-op", "test-id-token");
      expect(url).toContain("id_token_hint=test-id-token");
    });

    it("should include post_logout_redirect_uri", () => {
      const url = auth.getLogoutUrl(
        "test-op",
        undefined,
        "https://portal.example.com/logged-out",
      );
      expect(url).toContain(
        "post_logout_redirect_uri=" +
          encodeURIComponent("https://portal.example.com/logged-out"),
      );
    });

    it("should include both parameters", () => {
      const url = auth.getLogoutUrl(
        "test-op",
        "test-id-token",
        "https://portal.example.com/logged-out",
      );
      expect(url).toContain("id_token_hint=test-id-token");
      expect(url).toContain("post_logout_redirect_uri=");
    });
  });
});
