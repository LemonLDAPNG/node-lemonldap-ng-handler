/**
 * OIDC Interoperability Test: JS as OP, Perl as RP
 *
 * Tests the JS OIDC Provider (issuer-oidc) against the reference
 * Perl LemonLDAP::NG implementation running in Docker as RP.
 *
 * Prerequisites:
 *   docker-compose -f test/interop/docker-compose.perl-rp.yml up -d
 *
 * Configuration:
 *   - JS OP: http://localhost:19876 (started by this test)
 *   - Perl RP: http://localhost:19081 (Docker container)
 *   - client_id: llngperl
 *   - client_secret: llngperlpwd
 */

import * as http from "http";
import * as express from "express";
import { Express } from "express";
import { Server } from "http";
import { OIDCProvider } from "../../packages/issuer-oidc/src/provider";
import { createOIDCRouter } from "../../packages/issuer-oidc/src/router";

const JS_OP_PORT = 19876;
const JS_OP_URL = `http://localhost:${JS_OP_PORT}`;
// Issuer URL used by Perl RP inside Docker to reach JS OP on host
const JS_OP_ISSUER = "http://host.docker.internal:19876";
const PERL_RP_URL = "http://localhost:19081";
const CLIENT_ID = "llngperl";
const CLIENT_SECRET = "llngperlpwd";

// Test user data (simulating authenticated user on OP)
const testUser = {
  id: "dwho",
  sessionId: "session-test-123",
  claims: {
    sub: "dwho",
    name: "Doctor Who",
    email: "dwho@example.com",
    given_name: "Doctor",
    family_name: "Who",
  },
};

// Silent logger
const silentLogger = {
  error: () => {},
  warn: () => {},
  notice: () => {},
  info: () => {},
  debug: () => {},
};

/**
 * Simple HTTP client for testing
 */
async function httpGet(
  url: string,
  options: {
    headers?: Record<string, string>;
    followRedirects?: boolean;
    cookies?: string[];
  } = {},
): Promise<{
  status: number;
  headers: Record<string, string>;
  body: string;
  location?: string;
  cookies: string[];
}> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";

    const reqOptions: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: {
        ...options.headers,
        ...(options.cookies ? { Cookie: options.cookies.join("; ") } : {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === "string") {
            headers[key.toLowerCase()] = value;
          } else if (Array.isArray(value)) {
            headers[key.toLowerCase()] = value[0];
          }
        }

        // Extract cookies from set-cookie headers
        const setCookies = res.headers["set-cookie"] || [];
        const cookies = setCookies.map((c) => c.split(";")[0]);

        resolve({
          status: res.statusCode || 0,
          headers,
          body,
          location: res.headers.location,
          cookies,
        });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function httpPost(
  url: string,
  data: string | URLSearchParams,
  options: {
    headers?: Record<string, string>;
    cookies?: string[];
  } = {},
): Promise<{
  status: number;
  headers: Record<string, string>;
  body: string;
  location?: string;
  cookies: string[];
}> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const bodyStr = data instanceof URLSearchParams ? data.toString() : data;

    const reqOptions: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(bodyStr),
        ...options.headers,
        ...(options.cookies ? { Cookie: options.cookies.join("; ") } : {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === "string") {
            headers[key.toLowerCase()] = value;
          } else if (Array.isArray(value)) {
            headers[key.toLowerCase()] = value[0];
          }
        }

        const setCookies = res.headers["set-cookie"] || [];
        const cookies = setCookies.map((c) => c.split(";")[0]);

        resolve({
          status: res.statusCode || 0,
          headers,
          body,
          location: res.headers.location,
          cookies,
        });
      });
    });
    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

/**
 * Check if Docker container is available
 */
async function isPerlRPAvailable(): Promise<boolean> {
  try {
    const response = await httpGet(PERL_RP_URL);
    // Perl RP should redirect to OIDC OP or show login page
    return response.status === 200 || response.status === 302;
  } catch {
    return false;
  }
}

// Test state
let dockerAvailable = false;
let opApp: Express;
let opServer: Server;
let provider: OIDCProvider;

beforeAll(async () => {
  dockerAvailable = await isPerlRPAvailable();
  if (!dockerAvailable) {
    console.warn(
      "\n\u26a0\ufe0f  Perl RP Docker container not available. Skipping interop tests.\n" +
        "   Start with: docker-compose -f test/interop/docker-compose.perl-rp.yml up -d\n",
    );
    return;
  }

  // Generate RSA key for signing
  const { generateKeyPair } = await import("crypto");
  const { promisify } = await import("util");
  const generateKeyPairAsync = promisify(generateKeyPair);

  const { privateKey } = await generateKeyPairAsync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  // Setup OIDC Provider (JS OP)
  // Use issuer URL that Docker container can reach (host.docker.internal)
  provider = new OIDCProvider({
    portal: JS_OP_ISSUER,
    oidcServiceMetaDataIssuer: JS_OP_ISSUER,
    basePath: "/oauth2",
    oidcServicePrivateKeySig: privateKey as string,
    oidcServiceKeyIdSig: "js-op-key-1",
    oidcRPMetaDataOptions: {
      "perl-rp": {
        oidcRPMetaDataOptionsClientID: CLIENT_ID,
        oidcRPMetaDataOptionsClientSecret: CLIENT_SECRET,
        oidcRPMetaDataOptionsRedirectUris: [
          `${PERL_RP_URL}/`,
          `${PERL_RP_URL}/?openidconnectcallback=1`,
        ],
        oidcRPMetaDataOptionsBypassConsent: true,
        oidcRPMetaDataOptionsIDTokenExpiration: 3600,
        oidcRPMetaDataOptionsAccessTokenExpiration: 3600,
        oidcRPMetaDataOptionsIDTokenSignAlg: "RS256",
      },
    },
    oidcRPMetaDataExportedVars: {
      "perl-rp": {
        sub: "uid",
        name: "cn",
        email: "mail",
        family_name: "sn",
        given_name: "givenName",
      },
    },
    getSession: async (sessionId: string) => {
      if (sessionId === testUser.sessionId) {
        return {
          uid: testUser.id,
          cn: testUser.claims.name,
          mail: testUser.claims.email,
          sn: testUser.claims.family_name,
          givenName: testUser.claims.given_name,
        };
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

  // Create OIDC router
  const router = createOIDCRouter({
    provider,
    checkAuth: async () => ({
      userId: testUser.id,
      sessionId: testUser.sessionId,
    }),
    handleConsent: async () => true,
  });

  // Mount router at /oauth2 prefix
  opApp.use("/oauth2", router);

  // Also mount discovery at root (as Perl expects it)
  opApp.get("/.well-known/openid-configuration", (req, res) => {
    res.json(provider.getDiscoveryMetadata());
  });

  // Start OP server
  await new Promise<void>((resolve) => {
    opServer = opApp.listen(JS_OP_PORT, () => {
      resolve();
    });
  });
}, 30000);

afterAll(async () => {
  if (opServer) {
    await new Promise<void>((resolve) => {
      opServer.close(() => resolve());
    });
  }
});

describe("OIDC Interop: JS OP with Perl RP", () => {
  describe("JS OP Discovery", () => {
    it("should serve OIDC discovery document", async () => {
      if (!dockerAvailable) return;

      const response = await httpGet(
        `${JS_OP_URL}/.well-known/openid-configuration`,
      );

      expect(response.status).toBe(200);
      const metadata = JSON.parse(response.body);

      expect(metadata.issuer).toBe(JS_OP_ISSUER);
      expect(metadata.authorization_endpoint).toBeDefined();
      expect(metadata.token_endpoint).toBeDefined();
      expect(metadata.userinfo_endpoint).toBeDefined();
      expect(metadata.jwks_uri).toBeDefined();
    });

    it("should serve JWKS endpoint", async () => {
      if (!dockerAvailable) return;

      const response = await httpGet(`${JS_OP_URL}/oauth2/jwks`);

      expect(response.status).toBe(200);
      const jwks = JSON.parse(response.body);

      expect(jwks.keys).toBeDefined();
      expect(Array.isArray(jwks.keys)).toBe(true);
      expect(jwks.keys.length).toBeGreaterThan(0);

      // Check key structure
      const key = jwks.keys[0];
      expect(key.kty).toBe("RSA");
      expect(key.kid).toBe("js-op-key-1");
    });
  });

  describe("Perl RP Availability", () => {
    it("should be accessible", async () => {
      if (!dockerAvailable) return;

      const response = await httpGet(PERL_RP_URL);
      // Perl RP configured with OIDC auth should redirect or show login
      expect([200, 302, 303]).toContain(response.status);
    });

    it("should be configured for OIDC authentication", async () => {
      if (!dockerAvailable) return;

      // Access the portal - it should redirect to OIDC OP
      const response = await httpGet(PERL_RP_URL);

      // When configured with OIDC authentication, Perl portal should
      // redirect to the OIDC OP's authorization endpoint
      if (response.status === 302 || response.status === 303) {
        const location = response.location;
        expect(location).toBeDefined();
        // Should redirect to JS OP authorize endpoint
        expect(location).toContain("/oauth2/authorize");
      } else {
        // Or show a page with OIDC login option
        expect(response.status).toBe(200);
      }
    });
  });

  describe("JS OP Authorization Endpoint", () => {
    it("should accept valid authorization request", async () => {
      if (!dockerAvailable) return;

      const authUrl = new URL(`${JS_OP_URL}/oauth2/authorize`);
      authUrl.searchParams.set("client_id", CLIENT_ID);
      authUrl.searchParams.set(
        "redirect_uri",
        `${PERL_RP_URL}/?openidconnectcallback=1`,
      );
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid profile");
      authUrl.searchParams.set("state", "test-state-123");

      const response = await httpGet(authUrl.toString());

      // Should redirect with authorization code
      expect(response.status).toBe(302);
      expect(response.location).toBeDefined();

      const redirectUrl = new URL(response.location!);
      expect(redirectUrl.searchParams.get("code")).toBeTruthy();
      expect(redirectUrl.searchParams.get("state")).toBe("test-state-123");
    });

    it("should reject unknown client_id", async () => {
      if (!dockerAvailable) return;

      const authUrl = new URL(`${JS_OP_URL}/oauth2/authorize`);
      authUrl.searchParams.set("client_id", "unknown-client");
      authUrl.searchParams.set("redirect_uri", `${PERL_RP_URL}/callback`);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid");
      authUrl.searchParams.set("state", "test-state");

      const response = await httpGet(authUrl.toString());

      // Should redirect with error
      expect(response.status).toBe(302);
      expect(response.location).toContain("error=");
    });
  });

  describe("JS OP Token Endpoint", () => {
    it("should exchange authorization code for tokens", async () => {
      if (!dockerAvailable) return;

      // First get an authorization code
      const authUrl = new URL(`${JS_OP_URL}/oauth2/authorize`);
      authUrl.searchParams.set("client_id", CLIENT_ID);
      authUrl.searchParams.set(
        "redirect_uri",
        `${PERL_RP_URL}/?openidconnectcallback=1`,
      );
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid profile email");
      authUrl.searchParams.set("state", "test-state");
      authUrl.searchParams.set("nonce", "test-nonce");

      const authResponse = await httpGet(authUrl.toString());
      expect(authResponse.status).toBe(302);

      const redirectUrl = new URL(authResponse.location!);
      const code = redirectUrl.searchParams.get("code");
      expect(code).toBeTruthy();

      // Exchange code for tokens
      const tokenResponse = await httpPost(
        `${JS_OP_URL}/oauth2/token`,
        new URLSearchParams({
          grant_type: "authorization_code",
          code: code!,
          redirect_uri: `${PERL_RP_URL}/?openidconnectcallback=1`,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }),
      );

      expect(tokenResponse.status).toBe(200);
      const tokens = JSON.parse(tokenResponse.body);

      expect(tokens.access_token).toBeDefined();
      expect(tokens.token_type).toBe("Bearer");
      expect(tokens.id_token).toBeDefined();
      expect(tokens.expires_in).toBeDefined();
    });

    it("should reject invalid client_secret", async () => {
      if (!dockerAvailable) return;

      // Get an authorization code
      const authUrl = new URL(`${JS_OP_URL}/oauth2/authorize`);
      authUrl.searchParams.set("client_id", CLIENT_ID);
      authUrl.searchParams.set(
        "redirect_uri",
        `${PERL_RP_URL}/?openidconnectcallback=1`,
      );
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid");
      authUrl.searchParams.set("state", "test");

      const authResponse = await httpGet(authUrl.toString());
      const redirectUrl = new URL(authResponse.location!);
      const code = redirectUrl.searchParams.get("code");

      // Try to exchange with wrong secret
      const tokenResponse = await httpPost(
        `${JS_OP_URL}/oauth2/token`,
        new URLSearchParams({
          grant_type: "authorization_code",
          code: code!,
          redirect_uri: `${PERL_RP_URL}/?openidconnectcallback=1`,
          client_id: CLIENT_ID,
          client_secret: "wrong-secret",
        }),
      );

      expect(tokenResponse.status).toBe(401);
      const error = JSON.parse(tokenResponse.body);
      expect(error.error).toBe("invalid_client");
    });
  });

  describe("JS OP UserInfo Endpoint", () => {
    it("should return user info with valid access token", async () => {
      if (!dockerAvailable) return;

      // Get tokens
      const authUrl = new URL(`${JS_OP_URL}/oauth2/authorize`);
      authUrl.searchParams.set("client_id", CLIENT_ID);
      authUrl.searchParams.set(
        "redirect_uri",
        `${PERL_RP_URL}/?openidconnectcallback=1`,
      );
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid profile email");
      authUrl.searchParams.set("state", "test");

      const authResponse = await httpGet(authUrl.toString());
      const redirectUrl = new URL(authResponse.location!);
      const code = redirectUrl.searchParams.get("code");

      const tokenResponse = await httpPost(
        `${JS_OP_URL}/oauth2/token`,
        new URLSearchParams({
          grant_type: "authorization_code",
          code: code!,
          redirect_uri: `${PERL_RP_URL}/?openidconnectcallback=1`,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }),
      );

      const tokens = JSON.parse(tokenResponse.body);

      // Get userinfo
      const userinfoResponse = await httpGet(`${JS_OP_URL}/oauth2/userinfo`, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      expect(userinfoResponse.status).toBe(200);
      const userinfo = JSON.parse(userinfoResponse.body);

      expect(userinfo.sub).toBe(testUser.id);
    });

    it("should reject invalid access token", async () => {
      if (!dockerAvailable) return;

      const response = await httpGet(`${JS_OP_URL}/oauth2/userinfo`, {
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      expect(response.status).toBe(401);
      const error = JSON.parse(response.body);
      expect(error.error).toBe("invalid_token");
    });
  });

  describe("JS OP Introspection Endpoint", () => {
    it("should introspect valid access token", async () => {
      if (!dockerAvailable) return;

      // Get tokens
      const authUrl = new URL(`${JS_OP_URL}/oauth2/authorize`);
      authUrl.searchParams.set("client_id", CLIENT_ID);
      authUrl.searchParams.set(
        "redirect_uri",
        `${PERL_RP_URL}/?openidconnectcallback=1`,
      );
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid");
      authUrl.searchParams.set("state", "test");

      const authResponse = await httpGet(authUrl.toString());
      const redirectUrl = new URL(authResponse.location!);
      const code = redirectUrl.searchParams.get("code");

      const tokenResponse = await httpPost(
        `${JS_OP_URL}/oauth2/token`,
        new URLSearchParams({
          grant_type: "authorization_code",
          code: code!,
          redirect_uri: `${PERL_RP_URL}/?openidconnectcallback=1`,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }),
      );

      const tokens = JSON.parse(tokenResponse.body);

      // Introspect token
      const introspectResponse = await httpPost(
        `${JS_OP_URL}/oauth2/introspect`,
        new URLSearchParams({
          token: tokens.access_token,
        }),
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
          },
        },
      );

      expect(introspectResponse.status).toBe(200);
      const introspection = JSON.parse(introspectResponse.body);

      expect(introspection.active).toBe(true);
      expect(introspection.client_id).toBe(CLIENT_ID);
      expect(introspection.sub).toBe(testUser.id);
    });
  });
});

describe("OIDC Interop: ID Token Validation", () => {
  it("should generate valid ID token with correct claims", async () => {
    if (!dockerAvailable) return;

    // Get tokens
    const authUrl = new URL(`${JS_OP_URL}/oauth2/authorize`);
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set(
      "redirect_uri",
      `${PERL_RP_URL}/?openidconnectcallback=1`,
    );
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid profile email");
    authUrl.searchParams.set("state", "test");
    authUrl.searchParams.set("nonce", "test-nonce-123");

    const authResponse = await httpGet(authUrl.toString());
    const redirectUrl = new URL(authResponse.location!);
    const code = redirectUrl.searchParams.get("code");

    const tokenResponse = await httpPost(
      `${JS_OP_URL}/oauth2/token`,
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: `${PERL_RP_URL}/?openidconnectcallback=1`,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    );

    const tokens = JSON.parse(tokenResponse.body);
    expect(tokens.id_token).toBeDefined();

    // Decode ID token (without verification, just for inspection)
    const [, payloadB64] = tokens.id_token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

    expect(payload.iss).toBe(JS_OP_ISSUER);
    expect(payload.sub).toBe(testUser.id);
    expect(payload.aud).toBe(CLIENT_ID);
    expect(payload.nonce).toBe("test-nonce-123");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it("should include at_hash in ID token", async () => {
    if (!dockerAvailable) return;

    // Get tokens
    const authUrl = new URL(`${JS_OP_URL}/oauth2/authorize`);
    authUrl.searchParams.set("client_id", CLIENT_ID);
    authUrl.searchParams.set(
      "redirect_uri",
      `${PERL_RP_URL}/?openidconnectcallback=1`,
    );
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid");
    authUrl.searchParams.set("state", "test");

    const authResponse = await httpGet(authUrl.toString());
    const redirectUrl = new URL(authResponse.location!);
    const code = redirectUrl.searchParams.get("code");

    const tokenResponse = await httpPost(
      `${JS_OP_URL}/oauth2/token`,
      new URLSearchParams({
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: `${PERL_RP_URL}/?openidconnectcallback=1`,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    );

    const tokens = JSON.parse(tokenResponse.body);
    const [, payloadB64] = tokens.id_token.split(".");
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

    // at_hash should be present (hash of access_token)
    expect(payload.at_hash).toBeDefined();
    expect(typeof payload.at_hash).toBe("string");
  });
});

describe("OIDC Interop: Metadata Compatibility", () => {
  it("should have compatible response_types_supported", async () => {
    if (!dockerAvailable) return;

    const response = await httpGet(
      `${JS_OP_URL}/.well-known/openid-configuration`,
    );
    const metadata = JSON.parse(response.body);

    // Must support authorization code flow
    expect(metadata.response_types_supported).toContain("code");
  });

  it("should have compatible grant_types_supported", async () => {
    if (!dockerAvailable) return;

    const response = await httpGet(
      `${JS_OP_URL}/.well-known/openid-configuration`,
    );
    const metadata = JSON.parse(response.body);

    // Must support authorization_code grant
    expect(metadata.grant_types_supported).toContain("authorization_code");
  });

  it("should have compatible token_endpoint_auth_methods_supported", async () => {
    if (!dockerAvailable) return;

    const response = await httpGet(
      `${JS_OP_URL}/.well-known/openid-configuration`,
    );
    const metadata = JSON.parse(response.body);

    // Must support client_secret_post (as configured in Perl RP)
    const authMethods = metadata.token_endpoint_auth_methods_supported || [];
    expect(authMethods).toContain("client_secret_post");
  });

  it("should have compatible id_token_signing_alg_values_supported", async () => {
    if (!dockerAvailable) return;

    const response = await httpGet(
      `${JS_OP_URL}/.well-known/openid-configuration`,
    );
    const metadata = JSON.parse(response.body);

    // Must support RS256
    expect(metadata.id_token_signing_alg_values_supported).toContain("RS256");
  });

  it("should have compatible subject_types_supported", async () => {
    if (!dockerAvailable) return;

    const response = await httpGet(
      `${JS_OP_URL}/.well-known/openid-configuration`,
    );
    const metadata = JSON.parse(response.body);

    // Must support public subject type
    expect(metadata.subject_types_supported).toContain("public");
  });

  it("should have compatible code_challenge_methods_supported", async () => {
    if (!dockerAvailable) return;

    const response = await httpGet(
      `${JS_OP_URL}/.well-known/openid-configuration`,
    );
    const metadata = JSON.parse(response.body);

    // Should support S256 for PKCE
    expect(metadata.code_challenge_methods_supported).toContain("S256");
  });
});
