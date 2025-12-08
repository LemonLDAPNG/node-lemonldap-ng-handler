/**
 * OIDC Interoperability Test: JS as RP, Perl as OP
 *
 * Tests the JS OIDC client (auth-oidc) against the reference
 * Perl LemonLDAP::NG implementation running in Docker.
 *
 * Prerequisites:
 *   docker-compose -f test/interop/docker-compose.perl-op.yml up -d
 *
 * Configuration:
 *   - Perl OP: http://localhost:19080
 *   - JS RP callback: http://localhost:19876/?oidccallback=1
 *   - client_id: llngjs
 *   - client_secret: llngjspwd
 */

import * as http from "http";
import * as https from "https";

const PERL_OP_URL = "http://localhost:19080";
const JS_CALLBACK_URL = "http://localhost:19876/?oidccallback=1";
const CLIENT_ID = "llngjs";
const CLIENT_SECRET = "llngjspwd";

// Demo users in Perl portal
const TEST_USER = "dwho";
const TEST_PASSWORD = "dwho";

/**
 * Simple HTTP client for testing
 */
async function httpGet(
  url: string,
  options: { headers?: Record<string, string>; followRedirects?: boolean } = {},
): Promise<{
  status: number;
  headers: Record<string, string>;
  body: string;
  location?: string;
}> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const req = client.get(
      url,
      {
        headers: options.headers || {},
      },
      (res) => {
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
          resolve({
            status: res.statusCode || 0,
            headers,
            body,
            location: res.headers.location,
          });
        });
      },
    );
    req.on("error", reject);
  });
}

/**
 * Check if Docker container is available
 */
async function isPerlOPAvailable(): Promise<boolean> {
  try {
    const response = await httpGet(
      `${PERL_OP_URL}/.well-known/openid-configuration`,
      {},
    );
    return response.status === 200;
  } catch {
    return false;
  }
}

// Conditionally run tests based on Docker availability
let dockerAvailable = false;

beforeAll(async () => {
  dockerAvailable = await isPerlOPAvailable();
  if (!dockerAvailable) {
    console.warn(
      "\n⚠️  Perl OP Docker container not available. Skipping interop tests.\n" +
        "   Start with: docker-compose -f test/interop/docker-compose.perl-op.yml up -d\n",
    );
  }
}, 10000);

describe("OIDC Interop: JS RP with Perl OP", () => {
  describe("Perl OP Discovery", () => {
    it("should serve OIDC discovery document", async () => {
      if (!dockerAvailable) return;

      const response = await httpGet(
        `${PERL_OP_URL}/.well-known/openid-configuration`,
      );

      expect(response.status).toBe(200);
      const metadata = JSON.parse(response.body);

      expect(metadata.issuer).toBe(PERL_OP_URL + "/");
      expect(metadata.authorization_endpoint).toBeDefined();
      expect(metadata.token_endpoint).toBeDefined();
      expect(metadata.userinfo_endpoint).toBeDefined();
      expect(metadata.jwks_uri).toBeDefined();
    });

    it("should serve JWKS endpoint", async () => {
      if (!dockerAvailable) return;

      const response = await httpGet(`${PERL_OP_URL}/oauth2/jwks`);

      expect(response.status).toBe(200);
      const jwks = JSON.parse(response.body);

      expect(jwks.keys).toBeDefined();
      expect(Array.isArray(jwks.keys)).toBe(true);
      expect(jwks.keys.length).toBeGreaterThan(0);

      // Check key structure
      const key = jwks.keys[0];
      expect(key.kty).toBeDefined();
      expect(key.kid).toBeDefined();
    });
  });

  describe("JS OIDCAuth Module", () => {
    it("should initialize OIDCAuth with Perl OP configuration", async () => {
      if (!dockerAvailable) return;

      const { OIDCAuth } = await import("../../packages/auth-oidc/src/auth");

      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "perl-op": {
            confKey: "perl-op",
            oidcOPMetaDataOptions: {
              oidcOPMetaDataOptionsClientID: CLIENT_ID,
              oidcOPMetaDataOptionsClientSecret: CLIENT_SECRET,
              oidcOPMetaDataOptionsConfigurationURI: `${PERL_OP_URL}/.well-known/openid-configuration`,
              oidcOPMetaDataOptionsScope: "openid profile email",
              oidcOPMetaDataOptionsUsePKCE: false,
            },
            oidcOPMetaDataExportedVars: {
              uid: "preferred_username",
              mail: "email",
              cn: "name",
            },
          },
        },
        logger: {
          error: () => {},
          warn: () => {},
          notice: () => {},
          info: () => {},
          debug: () => {},
        },
      });

      await auth.init();

      // Should be able to get authorization URL
      const authUrl = await auth.getAuthorizationUrl(
        "perl-op",
        JS_CALLBACK_URL,
      );

      expect(authUrl).toBeDefined();
      expect(authUrl).toContain(PERL_OP_URL);
      expect(authUrl).toContain("/oauth2/authorize");
      expect(authUrl).toContain(`client_id=${CLIENT_ID}`);
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("scope=openid");
    });

    it("should generate authorization URL with state parameter", async () => {
      if (!dockerAvailable) return;

      const { OIDCAuth } = await import("../../packages/auth-oidc/src/auth");

      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "perl-op": {
            confKey: "perl-op",
            oidcOPMetaDataOptions: {
              oidcOPMetaDataOptionsClientID: CLIENT_ID,
              oidcOPMetaDataOptionsClientSecret: CLIENT_SECRET,
              oidcOPMetaDataOptionsConfigurationURI: `${PERL_OP_URL}/.well-known/openid-configuration`,
              oidcOPMetaDataOptionsScope: "openid profile email",
            },
            oidcOPMetaDataExportedVars: {},
          },
        },
        logger: {
          error: () => {},
          warn: () => {},
          notice: () => {},
          info: () => {},
          debug: () => {},
        },
      });

      await auth.init();

      const authUrl = await auth.getAuthorizationUrl(
        "perl-op",
        JS_CALLBACK_URL,
      );

      // Parse URL and check for state
      const url = new URL(authUrl);
      const state = url.searchParams.get("state");

      expect(state).toBeDefined();
      expect(state!.length).toBeGreaterThan(10);
    });

    it("should generate authorization URL with PKCE when enabled", async () => {
      if (!dockerAvailable) return;

      const { OIDCAuth } = await import("../../packages/auth-oidc/src/auth");

      const auth = new OIDCAuth({
        oidcOPMetaData: {
          "perl-op": {
            confKey: "perl-op",
            oidcOPMetaDataOptions: {
              oidcOPMetaDataOptionsClientID: CLIENT_ID,
              oidcOPMetaDataOptionsClientSecret: CLIENT_SECRET,
              oidcOPMetaDataOptionsConfigurationURI: `${PERL_OP_URL}/.well-known/openid-configuration`,
              oidcOPMetaDataOptionsScope: "openid profile email",
              oidcOPMetaDataOptionsUsePKCE: true,
              oidcOPMetaDataOptionsPKCEMethod: "S256",
            },
            oidcOPMetaDataExportedVars: {},
          },
        },
        logger: {
          error: () => {},
          warn: () => {},
          notice: () => {},
          info: () => {},
          debug: () => {},
        },
      });

      await auth.init();

      const authUrl = await auth.getAuthorizationUrl(
        "perl-op",
        JS_CALLBACK_URL,
      );

      // Parse URL and check for PKCE
      const url = new URL(authUrl);
      const codeChallenge = url.searchParams.get("code_challenge");
      const codeChallengeMethod = url.searchParams.get("code_challenge_method");

      expect(codeChallenge).toBeDefined();
      expect(codeChallengeMethod).toBe("S256");
    });
  });

  describe("Authorization Endpoint", () => {
    it("should redirect unauthenticated request to login", async () => {
      if (!dockerAvailable) return;

      const authUrl = new URL(`${PERL_OP_URL}/oauth2/authorize`);
      authUrl.searchParams.set("client_id", CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", JS_CALLBACK_URL);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid profile email");
      authUrl.searchParams.set("state", "test-state-123");

      const response = await httpGet(authUrl.toString());

      // Perl OP should redirect to login or show login form
      expect([200, 302, 303]).toContain(response.status);

      if (response.status === 302 || response.status === 303) {
        // Redirect to login page
        expect(response.location).toBeDefined();
      } else {
        // Login form displayed
        expect(response.body).toContain("form");
      }
    });
  });
});

describe("OIDC Interop: Metadata Compatibility", () => {
  it("should have compatible response_types_supported", async () => {
    if (!dockerAvailable) return;

    const response = await httpGet(
      `${PERL_OP_URL}/.well-known/openid-configuration`,
    );
    const metadata = JSON.parse(response.body);

    // Must support authorization code flow
    expect(metadata.response_types_supported).toContain("code");
  });

  it("should have compatible grant_types_supported", async () => {
    if (!dockerAvailable) return;

    const response = await httpGet(
      `${PERL_OP_URL}/.well-known/openid-configuration`,
    );
    const metadata = JSON.parse(response.body);

    // Must support authorization_code grant
    expect(metadata.grant_types_supported).toContain("authorization_code");
  });

  it("should have compatible token_endpoint_auth_methods_supported", async () => {
    if (!dockerAvailable) return;

    const response = await httpGet(
      `${PERL_OP_URL}/.well-known/openid-configuration`,
    );
    const metadata = JSON.parse(response.body);

    // Must support client_secret_post or client_secret_basic
    const authMethods = metadata.token_endpoint_auth_methods_supported || [];
    const hasCompatibleMethod =
      authMethods.includes("client_secret_post") ||
      authMethods.includes("client_secret_basic");

    expect(hasCompatibleMethod).toBe(true);
  });

  it("should have compatible id_token_signing_alg_values_supported", async () => {
    if (!dockerAvailable) return;

    const response = await httpGet(
      `${PERL_OP_URL}/.well-known/openid-configuration`,
    );
    const metadata = JSON.parse(response.body);

    // Must support RS256
    expect(metadata.id_token_signing_alg_values_supported).toContain("RS256");
  });

  it("should have compatible subject_types_supported", async () => {
    if (!dockerAvailable) return;

    const response = await httpGet(
      `${PERL_OP_URL}/.well-known/openid-configuration`,
    );
    const metadata = JSON.parse(response.body);

    // Must support public subject type
    expect(metadata.subject_types_supported).toContain("public");
  });
});
