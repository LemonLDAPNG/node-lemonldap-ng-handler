/**
 * Tests for CAS Issuer
 * Based on reference tests: 31-CAS-*.t
 */

import { CASIssuer } from "./issuer";
import type {
  CASTicketStore,
  CASPGTIOUStore,
  CASIssuerConfig,
  PortalSessionData,
} from "./types";
import type { CASTicket, CASAppConfig } from "@lemonldap-ng/lib-cas";

// Mock implementations
function createMockTicketStore(): CASTicketStore {
  const store = new Map<string, CASTicket>();
  return {
    async get(ticketId: string) {
      return store.get(ticketId) || null;
    },
    async set(ticketId: string, ticket: CASTicket) {
      store.set(ticketId, ticket);
    },
    async delete(ticketId: string) {
      store.delete(ticketId);
    },
  };
}

function createMockPGTIOUStore(): CASPGTIOUStore {
  const store = new Map<string, string>();
  return {
    async get(pgtiou: string) {
      return store.get(pgtiou) || null;
    },
    async set(pgtiou: string, pgtId: string) {
      store.set(pgtiou, pgtId);
    },
    async delete(pgtiou: string) {
      store.delete(pgtiou);
    },
  };
}

function createMockSessionStore(): Map<string, PortalSessionData> {
  return new Map<string, PortalSessionData>();
}

describe("CASIssuer", () => {
  let issuer: CASIssuer;
  let ticketStore: CASTicketStore;
  let pgtIOUStore: CASPGTIOUStore;
  let sessionStore: Map<string, PortalSessionData>;
  let config: CASIssuerConfig;

  const testApp: CASAppConfig = {
    casAppMetaDataOptions: {
      casAppMetaDataOptionsService: "http://app.example.com",
      casAppMetaDataOptionsLogout: 1,
      casAppMetaDataOptionsAllowProxy: true,
    },
    casAppMetaDataExportedVars: {
      mail: "mail",
      cn: "cn",
      uid: "_user",
    },
  };

  const testSession: PortalSessionData = {
    _session_id: "session-123",
    _user: "dwho",
    _authLevel: 2,
    mail: "dwho@example.com",
    cn: "Doctor Who",
  };

  beforeEach(() => {
    ticketStore = createMockTicketStore();
    pgtIOUStore = createMockPGTIOUStore();
    sessionStore = createMockSessionStore();
    sessionStore.set("session-123", testSession);

    config = {
      casAppMetaDataOptions: {
        testApp: testApp,
      },
      casAccessControlPolicy: "error",
      ticketStore,
      pgtIOUStore,
      getSession: async (sessionId: string) =>
        sessionStore.get(sessionId) || null,
    };

    issuer = new CASIssuer(config);
  });

  describe("handleLogin", () => {
    it("should generate service ticket for valid service", async () => {
      const result = await issuer.handleLogin(
        { service: "http://app.example.com/login" },
        testSession,
      );

      expect(result.type).toBe("redirect");
      if (result.type === "redirect") {
        expect(result.url).toContain("http://app.example.com/login?ticket=ST-");
      }
    });

    it("should reject unregistered service with error policy", async () => {
      const result = await issuer.handleLogin(
        { service: "http://unknown.example.com" },
        testSession,
      );

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.code).toBe("INVALID_SERVICE");
      }
    });

    it("should return fake ticket with faketicket policy", async () => {
      const issuerFake = new CASIssuer({
        ...config,
        casAccessControlPolicy: "faketicket",
      });

      const result = await issuerFake.handleLogin(
        { service: "http://unknown.example.com" },
        testSession,
      );

      expect(result.type).toBe("redirect");
      if (result.type === "redirect") {
        expect(result.url).toContain("ticket=ST-fake-");
      }
    });

    it("should allow any service with none policy", async () => {
      const issuerNone = new CASIssuer({
        ...config,
        casAccessControlPolicy: "none",
      });

      const result = await issuerNone.handleLogin(
        { service: "http://unknown.example.com" },
        testSession,
      );

      expect(result.type).toBe("redirect");
    });

    it("should return error for missing service", async () => {
      const result = await issuer.handleLogin({}, testSession);

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.code).toBe("INVALID_REQUEST");
      }
    });

    it("should require auth level upgrade when needed", async () => {
      const highLevelApp: CASAppConfig = {
        casAppMetaDataOptions: {
          casAppMetaDataOptionsService: "http://secure.example.com",
          casAppMetaDataOptionsAuthnLevel: 5,
        },
      };

      const issuerWithLevel = new CASIssuer({
        ...config,
        casAppMetaDataOptions: { secureApp: highLevelApp },
      });

      const result = await issuerWithLevel.handleLogin(
        { service: "http://secure.example.com" },
        testSession,
      );

      expect(result.type).toBe("upgrade");
      if (result.type === "upgrade") {
        expect(result.targetLevel).toBe(5);
      }
    });

    it("should handle gateway mode for unauthenticated user", async () => {
      const unauthSession: PortalSessionData = {
        _session_id: "unauth-123",
        _user: "",
      };

      const issuerNone = new CASIssuer({
        ...config,
        casAccessControlPolicy: "none",
      });

      const result = await issuerNone.handleLogin(
        { service: "http://app.example.com", gateway: true },
        unauthSession,
      );

      expect(result.type).toBe("gateway");
      if (result.type === "gateway") {
        expect(result.url).toBe("http://app.example.com");
      }
    });

    it("should append ticket to service with existing query params", async () => {
      const result = await issuer.handleLogin(
        { service: "http://app.example.com/login?foo=bar" },
        testSession,
      );

      expect(result.type).toBe("redirect");
      if (result.type === "redirect") {
        expect(result.url).toContain("?foo=bar&ticket=ST-");
      }
    });
  });

  describe("handleValidate (CAS 1.0)", () => {
    it("should validate service ticket", async () => {
      // Generate ticket
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      // Validate
      const result = await issuer.handleValidate({
        service: "http://app.example.com",
        ticket,
      });

      expect(result).toBe("yes\ndwho\n");
    });

    it("should reject invalid ticket", async () => {
      const result = await issuer.handleValidate({
        service: "http://app.example.com",
        ticket: "ST-invalid",
      });

      expect(result).toBe("no\n\n");
    });

    it("should reject ticket with wrong service", async () => {
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      const result = await issuer.handleValidate({
        service: "http://other.example.com",
        ticket,
      });

      expect(result).toBe("no\n\n");
    });

    it("should reject reused ticket", async () => {
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      // First validation
      await issuer.handleValidate({
        service: "http://app.example.com",
        ticket,
      });

      // Second validation should fail
      const result = await issuer.handleValidate({
        service: "http://app.example.com",
        ticket,
      });

      expect(result).toBe("no\n\n");
    });

    it("should reject missing parameters", async () => {
      const result = await issuer.handleValidate({
        service: "",
        ticket: "",
      });

      expect(result).toBe("no\n\n");
    });
  });

  describe("handleServiceValidate (CAS 2.0/3.0)", () => {
    it("should return XML success with user", async () => {
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      const result = await issuer.handleServiceValidate({
        service: "http://app.example.com",
        ticket,
      });

      expect(result).toContain("<cas:authenticationSuccess>");
      expect(result).toContain("<cas:user>dwho</cas:user>");
    });

    it("should include attributes", async () => {
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      const result = await issuer.handleServiceValidate({
        service: "http://app.example.com",
        ticket,
      });

      expect(result).toContain("<cas:attributes>");
      expect(result).toContain("<cas:mail>dwho@example.com</cas:mail>");
      expect(result).toContain("<cas:cn>Doctor Who</cas:cn>");
      expect(result).toContain("<cas:uid>dwho</cas:uid>");
    });

    it("should return XML error for invalid ticket", async () => {
      const result = await issuer.handleServiceValidate({
        service: "http://app.example.com",
        ticket: "ST-invalid",
      });

      expect(result).toContain("<cas:authenticationFailure");
      expect(result).toContain("INVALID_TICKET");
    });

    it("should return XML error for missing parameters", async () => {
      const result = await issuer.handleServiceValidate({
        service: "",
        ticket: "",
      });

      expect(result).toContain("<cas:authenticationFailure");
      expect(result).toContain("INVALID_REQUEST");
    });

    it("should return XML error for service mismatch", async () => {
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      const result = await issuer.handleServiceValidate({
        service: "http://other.example.com",
        ticket,
      });

      expect(result).toContain("<cas:authenticationFailure");
      expect(result).toContain("INVALID_SERVICE");
    });

    it("should reject ticket without renew when renew requested", async () => {
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      const result = await issuer.handleServiceValidate({
        service: "http://app.example.com",
        ticket,
        renew: true,
      });

      expect(result).toContain("<cas:authenticationFailure");
      expect(result).toContain("INVALID_TICKET");
    });

    it("should accept ticket with renew when renew requested", async () => {
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com", renew: true },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      const result = await issuer.handleServiceValidate({
        service: "http://app.example.com",
        ticket,
        renew: true,
      });

      expect(result).toContain("<cas:authenticationSuccess>");
    });
  });

  describe("handleProxy", () => {
    it("should reject request without PGT", async () => {
      const result = await issuer.handleProxy({
        pgt: "",
        targetService: "http://target.example.com",
      });

      expect(result).toContain("<cas:proxyFailure");
      expect(result).toContain("INVALID_REQUEST");
    });

    it("should reject request with invalid PGT", async () => {
      const result = await issuer.handleProxy({
        pgt: "PGT-invalid",
        targetService: "http://target.example.com",
      });

      expect(result).toContain("<cas:proxyFailure");
      expect(result).toContain("INVALID_TICKET");
    });
  });

  describe("handleProxyValidate", () => {
    it("should validate ST same as serviceValidate", async () => {
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      const result = await issuer.handleProxyValidate({
        service: "http://app.example.com",
        ticket,
      });

      expect(result).toContain("<cas:authenticationSuccess>");
      expect(result).toContain("<cas:user>dwho</cas:user>");
    });

    it("should reject invalid ticket format", async () => {
      const result = await issuer.handleProxyValidate({
        service: "http://app.example.com",
        ticket: "INVALID-123",
      });

      expect(result).toContain("<cas:authenticationFailure");
      expect(result).toContain("INVALID_TICKET_SPEC");
    });
  });

  describe("handleSamlValidate", () => {
    it("should validate ticket via SAML request", async () => {
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      const samlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <saml1p:Request xmlns:saml1p="urn:oasis:names:tc:SAML:1.0:protocol" RequestID="_req123">
      <saml1p:AssertionArtifact>${ticket}</saml1p:AssertionArtifact>
    </saml1p:Request>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

      const result = await issuer.handleSamlValidate({
        TARGET: "http://app.example.com",
        body: samlRequest,
      });

      expect(result).toContain("SOAP-ENV:Envelope");
      expect(result).toContain("saml1p:Success");
      expect(result).toContain(
        "<saml1:NameIdentifier>dwho</saml1:NameIdentifier>",
      );
      expect(result).toContain('InResponseTo="_req123"');
    });

    it("should return SAML error for invalid request", async () => {
      const result = await issuer.handleSamlValidate({
        TARGET: "http://app.example.com",
        body: "invalid xml",
      });

      expect(result).toContain("SOAP-ENV:Envelope");
      expect(result).toContain("saml1p:RequestDenied");
      expect(result).toContain("INVALID_REQUEST");
    });

    it("should return SAML error for invalid ticket", async () => {
      const samlRequest = `<?xml version="1.0"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <saml1p:Request xmlns:saml1p="urn:oasis:names:tc:SAML:1.0:protocol">
      <saml1p:AssertionArtifact>ST-nonexistent</saml1p:AssertionArtifact>
    </saml1p:Request>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

      const result = await issuer.handleSamlValidate({
        TARGET: "http://app.example.com",
        body: samlRequest,
      });

      expect(result).toContain("saml1p:RequestDenied");
      expect(result).toContain("INVALID_TICKET");
    });

    it("should include attributes in SAML response", async () => {
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      const samlRequest = `<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <saml1p:Request xmlns:saml1p="urn:oasis:names:tc:SAML:1.0:protocol">
      <saml1p:AssertionArtifact>${ticket}</saml1p:AssertionArtifact>
    </saml1p:Request>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

      const result = await issuer.handleSamlValidate({
        TARGET: "http://app.example.com",
        body: samlRequest,
      });

      expect(result).toContain('AttributeName="mail"');
      expect(result).toContain(
        "<saml1:AttributeValue>dwho@example.com</saml1:AttributeValue>",
      );
    });
  });

  describe("handleLogout", () => {
    it("should return redirect URL when provided", async () => {
      // First login to register the app
      await issuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      const result = await issuer.handleLogout(
        { service: "http://app.example.com/logged-out" },
        "session-123",
      );

      expect(result.redirectUrl).toBe("http://app.example.com/logged-out");
    });

    it("should support CAS 2.0 url parameter", async () => {
      const result = await issuer.handleLogout(
        { url: "http://app.example.com/logged-out" },
        "session-123",
      );

      expect(result.redirectUrl).toBe("http://app.example.com/logged-out");
    });

    it("should handle logout without redirect", async () => {
      const result = await issuer.handleLogout({}, "session-123");

      expect(result.redirectUrl).toBeUndefined();
    });
  });

  describe("Ticket expiration", () => {
    it("should reject expired ticket", async () => {
      // Create issuer with very short TTL
      const shortTTLIssuer = new CASIssuer({
        ...config,
        ticketTTL: { ST: 1 }, // 1ms
      });

      const loginResult = await shortTTLIssuer.handleLogin(
        { service: "http://app.example.com" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await shortTTLIssuer.handleValidate({
        service: "http://app.example.com",
        ticket,
      });

      expect(result).toBe("no\n\n");
    });
  });

  describe("Service URL matching", () => {
    it("should match service with trailing slash difference", async () => {
      const loginResult = await issuer.handleLogin(
        { service: "http://app.example.com/" },
        testSession,
      );

      if (loginResult.type !== "redirect") throw new Error("Expected redirect");
      const ticket = new URL(loginResult.url).searchParams.get("ticket")!;

      const result = await issuer.handleValidate({
        service: "http://app.example.com",
        ticket,
      });

      expect(result).toBe("yes\ndwho\n");
    });
  });
});
