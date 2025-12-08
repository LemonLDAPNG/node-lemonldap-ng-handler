/**
 * SAML-OIDC Proxy Integration Tests
 *
 * Tests the proxy chain: IdP (SAML IdP) -> Proxy (SAML SP + OIDC OP) -> SP (OIDC RP)
 *
 * Note: These tests require lasso.js to be installed and properly configured.
 * If lasso.js is not available or SAML setup fails, tests will be skipped.
 */

import { TestHttpClient } from "./helpers/http-client";
import { createSAMLOIDCTestbed, ProxyTestbed } from "./helpers/portal-factory";

// Check if lasso.js is available
let lassoAvailable = false;
try {
  require("lasso.js");
  lassoAvailable = true;
} catch {
  // lasso.js not available
}

// Conditionally run these tests based on lasso.js availability
const describeIfLasso = lassoAvailable ? describe : describe.skip;

describeIfLasso("SAML-OIDC Proxy", () => {
  let testbed: ProxyTestbed;
  let client: TestHttpClient;
  let setupError: Error | null = null;

  beforeAll(async () => {
    try {
      // Create testbed with SAML frontend and OIDC backend
      testbed = await createSAMLOIDCTestbed(20); // Port offset to avoid conflicts
      await testbed.start();
      client = new TestHttpClient();
    } catch (err) {
      setupError = err as Error;
      console.warn("SAML setup failed, tests will be skipped:", err);
    }
  }, 30000);

  afterAll(async () => {
    if (testbed) {
      await testbed.stop();
    }
  });

  beforeEach(() => {
    client.clearCookies();
  });

  describe("Discovery Endpoints", () => {
    it("should serve IdP SAML metadata", async () => {
      const response = await client.get(`${testbed.idp.url}/saml/metadata`);
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("xml");
      expect(response.body).toContain("EntityDescriptor");
      expect(response.body).toContain("IDPSSODescriptor");
    });

    it("should serve Proxy OIDC discovery document", async () => {
      const response = await client.get(
        `${testbed.proxy.url}/.well-known/openid-configuration`,
      );
      expect(response.status).toBe(200);

      const metadata = JSON.parse(response.body);
      expect(metadata.issuer).toBe(testbed.proxy.url);
      expect(metadata.authorization_endpoint).toBeDefined();
      expect(metadata.token_endpoint).toBeDefined();
    });

    it("should serve Proxy JWKS", async () => {
      const response = await client.get(`${testbed.proxy.url}/oauth2/jwks`);
      expect(response.status).toBe(200);

      const jwks = JSON.parse(response.body);
      expect(jwks.keys).toBeDefined();
      expect(jwks.keys.length).toBeGreaterThan(0);
    });

    it("should serve Proxy SAML metadata", async () => {
      const response = await client.get(`${testbed.proxy.url}/saml/metadata`);
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("xml");
      expect(response.body).toContain("EntityDescriptor");
      expect(response.body).toContain("SPSSODescriptor");
    });
  });

  describe("Authentication Flow", () => {
    it("should redirect unauthenticated SP request to Proxy", async () => {
      const response = await client.get(`${testbed.sp.url}/`);

      // SP (OIDC RP) should redirect to Proxy (OIDC OP)
      expect(response.status).toBe(302);
      expect(response.redirectUrl).toBeDefined();
      expect(response.redirectUrl).toContain(testbed.proxy.url);
      expect(response.redirectUrl).toContain("/oauth2/authorize");
    });
  });
});
