/**
 * OIDC-SAML Proxy Integration Tests
 *
 * Tests the proxy chain: IdP (OIDC OP) -> Proxy (OIDC RP + SAML IdP) -> SP (SAML SP)
 *
 * Note: These tests require lasso.js to be installed and properly configured.
 * If lasso.js is not available or SAML setup fails, tests will be skipped.
 */

import { TestHttpClient } from "./helpers/http-client";
import { createOIDCSAMLTestbed, ProxyTestbed } from "./helpers/portal-factory";

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

describeIfLasso("OIDC-SAML Proxy", () => {
  let testbed: ProxyTestbed;
  let client: TestHttpClient;
  let setupError: Error | null = null;

  beforeAll(async () => {
    try {
      // Create testbed with OIDC frontend and SAML backend
      testbed = await createOIDCSAMLTestbed(10); // Port offset to avoid conflicts
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
    it("should serve IdP OIDC discovery document", async () => {
      const response = await client.get(
        `${testbed.idp.url}/.well-known/openid-configuration`,
      );
      expect(response.status).toBe(200);

      const metadata = JSON.parse(response.body);
      expect(metadata.issuer).toBe(testbed.idp.url);
      expect(metadata.authorization_endpoint).toBeDefined();
      expect(metadata.token_endpoint).toBeDefined();
    });

    it("should serve IdP JWKS", async () => {
      const response = await client.get(`${testbed.idp.url}/oauth2/jwks`);
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
      expect(response.body).toContain("IDPSSODescriptor");
    });

    it("should serve SP SAML metadata", async () => {
      const response = await client.get(`${testbed.sp.url}/saml/metadata`);
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("xml");
      expect(response.body).toContain("EntityDescriptor");
      expect(response.body).toContain("SPSSODescriptor");
    });
  });

  describe("Authentication Flow", () => {
    it("should redirect unauthenticated SP request to Proxy", async () => {
      const response = await client.get(`${testbed.sp.url}/`);

      // SP (SAML SP) should redirect to Proxy (SAML IdP)
      expect(response.status).toBe(302);
      expect(response.redirectUrl).toBeDefined();
      expect(response.redirectUrl).toContain(testbed.proxy.url);
      expect(response.redirectUrl).toContain("/saml/singleSignOn");
    });

    it("should redirect Proxy to IdP when not authenticated", async () => {
      // Start at SP
      let response = await client.get(`${testbed.sp.url}/`);
      expect(response.status).toBe(302);

      // Follow to Proxy's SAML SSO endpoint
      response = await client.followRedirect(response);

      // Proxy should redirect to IdP (OIDC authorize) since not authenticated
      // May go through multiple redirects
      let maxRedirects = 5;
      while (
        response.status === 302 &&
        !response.redirectUrl?.includes(testbed.idp.url) &&
        maxRedirects > 0
      ) {
        response = await client.followRedirect(response);
        maxRedirects--;
      }

      expect(response.redirectUrl || response.url).toContain(testbed.idp.url);
    });

    it("should show login form at IdP", async () => {
      // Start at SP
      let response = await client.get(`${testbed.sp.url}/`);

      // Follow redirects until we reach the IdP
      let maxRedirects = 15;
      while (response.status === 302 && maxRedirects > 0) {
        response = await client.followRedirect(response);
        maxRedirects--;
      }

      // IdP should show login form
      expect(response.status).toBe(200);
      expect(response.body).toContain("<form");
      expect(response.body).toContain("user");
      expect(response.body).toContain("password");
    });

    it("should authenticate through full chain", async () => {
      // 1. Start at SP (unauthenticated)
      let response = await client.get(`${testbed.sp.url}/`);
      expect(response.status).toBe(302);

      // 2. Follow all redirects until we reach IdP login form
      let maxRedirects = 15;
      while (response.status === 302 && maxRedirects > 0) {
        response = await client.followRedirect(response);
        maxRedirects--;
      }
      expect(response.status).toBe(200);
      expect(response.body).toContain("<form");

      // 3. Extract and submit login form
      const form = client.extractForm(response.body);
      expect(form).not.toBeNull();

      // Build the form action URL
      let formAction = form!.action || "";
      if (!formAction.startsWith("http")) {
        formAction = `${testbed.idp.url}${formAction.startsWith("/") ? "" : "/"}${formAction}`;
      }

      response = await client.postForm(formAction, {
        ...form!.fields,
        user: "dwho",
        password: "dwho",
      });

      // 4. Follow redirects back through the chain
      // OIDC callback -> Proxy -> SAML Response -> SP
      maxRedirects = 20;
      while (response.status === 302 && maxRedirects > 0) {
        response = await client.followRedirect(response);
        maxRedirects--;
      }

      // Handle SAML POST forms (auto-submit)
      while (
        response.status === 200 &&
        response.body.includes("onload") &&
        response.body.includes("submit") &&
        maxRedirects > 0
      ) {
        const samlForm = client.extractForm(response.body);
        if (samlForm && samlForm.action) {
          response = await client.postForm(samlForm.action, samlForm.fields);
          if (response.status === 302) {
            response = await client.followRedirect(response);
          }
        } else {
          break;
        }
        maxRedirects--;
      }

      // 5. Eventually we should land on authenticated SP page
      expect(response.status).toBe(200);
      // Check for authenticated content
      expect(response.body).toContain("dwho");
    });
  });

  describe("Session Management", () => {
    it("should create session on IdP after login", async () => {
      // Navigate to IdP and login directly
      let response = await client.get(`${testbed.idp.url}/`);
      expect(response.status).toBe(200);
      expect(response.body).toContain("<form");

      // Submit login
      const form = client.extractForm(response.body);
      expect(form).not.toBeNull();

      let formAction = form!.action || "/";
      if (!formAction.startsWith("http")) {
        formAction = `${testbed.idp.url}${formAction.startsWith("/") ? "" : "/"}${formAction}`;
      }

      response = await client.postForm(formAction, {
        ...form!.fields,
        user: "dwho",
        password: "dwho",
      });

      // Follow any redirects after login
      while (response.status === 302) {
        response = await client.followRedirect(response);
      }

      // Check for session cookie
      const idpDomain = new URL(testbed.idp.url).host;
      const idpCookies = client.getCookies(idpDomain);
      const sessionId = idpCookies.get("lemonldap");
      expect(sessionId).toBeDefined();

      // Verify session exists
      const session = testbed.idp.getSession(sessionId!);
      expect(session).not.toBeNull();
      expect(session._user).toBe("dwho");
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid credentials", async () => {
      // Navigate to IdP login
      let response = await client.get(`${testbed.idp.url}/`);
      expect(response.status).toBe(200);
      expect(response.body).toContain("<form");

      const form = client.extractForm(response.body);
      expect(form).not.toBeNull();

      let formAction = form!.action || "/";
      if (!formAction.startsWith("http")) {
        formAction = `${testbed.idp.url}${formAction.startsWith("/") ? "" : "/"}${formAction}`;
      }

      // Submit with wrong password
      response = await client.postForm(formAction, {
        ...form!.fields,
        user: "dwho",
        password: "wrongpassword",
      });

      // Should return error
      expect(response.status).toBe(401);
      expect(response.body).toContain("failed");
    });
  });

  // Skip SLO tests for now
  describe.skip("Single Logout (SLO)", () => {
    it("should propagate logout through chain", async () => {
      // TODO: Implement after full auth flow works
    });
  });
});
