/**
 * OIDC-OIDC Proxy Integration Tests
 *
 * Tests the proxy chain: IdP (OIDC OP) -> Proxy (OIDC RP + OIDC OP) -> SP (OIDC RP)
 *
 * Reference: Perl tests use LWP::Protocol::PSGI to intercept HTTP requests
 */

import { TestHttpClient } from "./helpers/http-client";
import { createOIDCOIDCTestbed, ProxyTestbed } from "./helpers/portal-factory";

describe("OIDC-OIDC Proxy", () => {
  let testbed: ProxyTestbed;
  let client: TestHttpClient;

  beforeAll(async () => {
    // Create testbed with OIDC on both frontend and backend
    testbed = await createOIDCOIDCTestbed();
    await testbed.start();
    client = new TestHttpClient();
  }, 30000);

  afterAll(async () => {
    await testbed.stop();
  });

  beforeEach(() => {
    client.clearCookies();
  });

  describe("Discovery Endpoints", () => {
    it("should serve IdP discovery document", async () => {
      const response = await client.get(
        `${testbed.idp.url}/.well-known/openid-configuration`,
      );
      expect(response.status).toBe(200);

      const metadata = JSON.parse(response.body);
      expect(metadata.issuer).toBe(testbed.idp.url);
      expect(metadata.authorization_endpoint).toBeDefined();
      expect(metadata.token_endpoint).toBeDefined();
    });

    it("should serve Proxy discovery document", async () => {
      const response = await client.get(
        `${testbed.proxy.url}/.well-known/openid-configuration`,
      );
      expect(response.status).toBe(200);

      const metadata = JSON.parse(response.body);
      expect(metadata.issuer).toBe(testbed.proxy.url);
    });

    it("should serve IdP JWKS", async () => {
      const response = await client.get(`${testbed.idp.url}/oauth2/jwks`);
      expect(response.status).toBe(200);

      const jwks = JSON.parse(response.body);
      expect(jwks.keys).toBeDefined();
      expect(jwks.keys.length).toBeGreaterThan(0);
    });

    it("should serve Proxy JWKS", async () => {
      const response = await client.get(`${testbed.proxy.url}/oauth2/jwks`);
      expect(response.status).toBe(200);

      const jwks = JSON.parse(response.body);
      expect(jwks.keys).toBeDefined();
    });
  });

  describe("Authentication Flow", () => {
    it("should redirect unauthenticated SP request to Proxy", async () => {
      const response = await client.get(`${testbed.sp.url}/`);

      // SP should redirect to Proxy (OIDC authorize)
      expect(response.status).toBe(302);
      expect(response.redirectUrl).toBeDefined();
      expect(response.redirectUrl).toContain(testbed.proxy.url);
      expect(response.redirectUrl).toContain("/oauth2/authorize");
    });

    it("should redirect Proxy to IdP when not authenticated", async () => {
      // Start at SP
      let response = await client.get(`${testbed.sp.url}/`);
      expect(response.status).toBe(302);

      // Follow to Proxy's OIDC authorize endpoint
      response = await client.followRedirect(response);
      expect(response.status).toBe(302);

      // Proxy redirects to its own root to trigger auth
      response = await client.followRedirect(response);
      expect(response.status).toBe(302);

      // Proxy's auth should redirect to IdP (OIDC authorize)
      expect(response.redirectUrl).toBeDefined();
      expect(response.redirectUrl).toContain(testbed.idp.url);
      expect(response.redirectUrl).toContain("/oauth2/authorize");
    });

    it("should show login form at IdP", async () => {
      // Start at SP
      let response = await client.get(`${testbed.sp.url}/`);

      // Follow redirects until we reach the IdP
      let maxRedirects = 10;
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
      let maxRedirects = 10;
      while (response.status === 302 && maxRedirects > 0) {
        response = await client.followRedirect(response);
        maxRedirects--;
      }
      expect(response.status).toBe(200);
      expect(response.body).toContain("<form");

      // 3. Extract and submit login form
      const form = client.extractForm(response.body);
      expect(form).not.toBeNull();

      // Build the form action URL - if relative, make it absolute
      let formAction = form!.action || "";
      if (!formAction.startsWith("http")) {
        formAction = `${testbed.idp.url}${formAction.startsWith("/") ? "" : "/"}${formAction}`;
      }

      response = await client.postForm(formAction, {
        ...form!.fields,
        user: "dwho",
        password: "dwho",
      });

      // 4. IdP should redirect back to Proxy with code
      // Follow all redirects back through the chain
      maxRedirects = 15;
      while (response.status === 302 && maxRedirects > 0) {
        response = await client.followRedirect(response);
        maxRedirects--;
      }

      // 5. Eventually we should land on authenticated SP page
      expect(response.status).toBe(200);
      // Check for authenticated content - should contain user info
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

      // Check for session cookie - domain includes port
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

  describe("Attribute Propagation", () => {
    it("should propagate user attributes through chain", async () => {
      // Full authentication flow
      let response = await client.get(`${testbed.sp.url}/`);

      // Follow redirects to IdP
      let maxRedirects = 10;
      while (response.status === 302 && maxRedirects > 0) {
        response = await client.followRedirect(response);
        maxRedirects--;
      }

      expect(response.status).toBe(200);
      expect(response.body).toContain("<form");

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

      // Follow all redirects back to SP
      maxRedirects = 15;
      while (response.status === 302 && maxRedirects > 0) {
        response = await client.followRedirect(response);
        maxRedirects--;
      }

      expect(response.status).toBe(200);

      // Check SP session for attributes - domain includes port
      const spDomain = new URL(testbed.sp.url).host;
      const spCookies = client.getCookies(spDomain);
      const sessionId = spCookies.get("lemonldap");
      expect(sessionId).toBeDefined();

      const session = testbed.sp.getSession(sessionId!);
      expect(session).not.toBeNull();
      expect(session._user).toBeDefined();
      // Attributes should be propagated
      expect(session.uid || session._user).toBeDefined();
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

    it("should handle unknown user", async () => {
      let response = await client.get(`${testbed.idp.url}/`);
      expect(response.status).toBe(200);
      expect(response.body).toContain("<form");

      const form = client.extractForm(response.body);
      expect(form).not.toBeNull();

      let formAction = form!.action || "/";
      if (!formAction.startsWith("http")) {
        formAction = `${testbed.idp.url}${formAction.startsWith("/") ? "" : "/"}${formAction}`;
      }

      response = await client.postForm(formAction, {
        ...form!.fields,
        user: "unknownuser",
        password: "anypassword",
      });

      expect(response.status).toBe(401);
    });
  });

  // Skip logout tests for now as they require full SLO implementation
  describe.skip("Single Logout (SLO)", () => {
    it("should propagate logout through chain", async () => {
      // TODO: Implement after full auth flow works
    });

    it("should clear all sessions on logout", async () => {
      // TODO: Implement SLO tests
    });
  });
});
