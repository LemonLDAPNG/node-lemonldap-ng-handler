/**
 * Tests for CAS XML building
 */

import {
  escapeXml,
  buildValidateSuccess,
  buildValidateFailure,
  buildServiceValidateSuccess,
  buildServiceValidateError,
  buildProxySuccess,
  buildProxyError,
  buildSamlValidateSuccess,
  buildSamlValidateError,
  buildLogoutRequest,
} from "./xml-builder";

describe("CAS XML Builder", () => {
  describe("escapeXml", () => {
    it("should escape special characters", () => {
      expect(escapeXml("<test>")).toBe("&lt;test&gt;");
      expect(escapeXml("a & b")).toBe("a &amp; b");
      expect(escapeXml('"quoted"')).toBe("&quot;quoted&quot;");
      expect(escapeXml("it's")).toBe("it&apos;s");
    });

    it("should handle empty string", () => {
      expect(escapeXml("")).toBe("");
    });

    it("should handle string without special chars", () => {
      expect(escapeXml("normal text")).toBe("normal text");
    });
  });

  describe("CAS 1.0 validate responses", () => {
    it("should build success response", () => {
      const response = buildValidateSuccess("dwho");
      expect(response).toBe("yes\ndwho\n");
    });

    it("should build failure response", () => {
      const response = buildValidateFailure();
      expect(response).toBe("no\n\n");
    });
  });

  describe("CAS 2.0/3.0 serviceValidate responses", () => {
    it("should build success response with user only", () => {
      const xml = buildServiceValidateSuccess("dwho");
      expect(xml).toContain("<cas:user>dwho</cas:user>");
      expect(xml).toContain("<cas:authenticationSuccess>");
      expect(xml).toContain("xmlns:cas=");
      expect(xml).not.toContain("<cas:attributes>");
    });

    it("should build success response with attributes", () => {
      const xml = buildServiceValidateSuccess("dwho", {
        mail: ["dwho@example.com"],
        cn: ["Doctor Who"],
        groups: ["admin", "users"],
      });
      expect(xml).toContain("<cas:user>dwho</cas:user>");
      expect(xml).toContain("<cas:attributes>");
      expect(xml).toContain("<cas:mail>dwho@example.com</cas:mail>");
      expect(xml).toContain("<cas:cn>Doctor Who</cas:cn>");
      expect(xml).toContain("<cas:groups>admin</cas:groups>");
      expect(xml).toContain("<cas:groups>users</cas:groups>");
    });

    it("should build success response with PGTIOU", () => {
      const xml = buildServiceValidateSuccess("dwho", undefined, "PGTIOU-123");
      expect(xml).toContain(
        "<cas:proxyGrantingTicket>PGTIOU-123</cas:proxyGrantingTicket>",
      );
    });

    it("should build success response with proxies", () => {
      const xml = buildServiceValidateSuccess("dwho", undefined, undefined, [
        "https://proxy1.example.com",
        "https://proxy2.example.com",
      ]);
      expect(xml).toContain("<cas:proxies>");
      expect(xml).toContain(
        "<cas:proxy>https://proxy1.example.com</cas:proxy>",
      );
      expect(xml).toContain(
        "<cas:proxy>https://proxy2.example.com</cas:proxy>",
      );
    });

    it("should escape special characters in user and attributes", () => {
      const xml = buildServiceValidateSuccess("<script>alert(1)</script>", {
        "test&attr": ["<value>"],
      });
      expect(xml).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(xml).toContain("&lt;value&gt;");
    });

    it("should build error response", () => {
      const xml = buildServiceValidateError(
        "INVALID_TICKET",
        "Ticket not found",
      );
      expect(xml).toContain(
        '<cas:authenticationFailure code="INVALID_TICKET">',
      );
      expect(xml).toContain("Ticket not found");
      expect(xml).not.toContain("<cas:authenticationSuccess>");
    });

    it("should escape error code and message", () => {
      const xml = buildServiceValidateError("CODE<test>", "Error & message");
      expect(xml).toContain("CODE&lt;test&gt;");
      expect(xml).toContain("Error &amp; message");
    });
  });

  describe("CAS 2.0 proxy responses", () => {
    it("should build proxy success response", () => {
      const xml = buildProxySuccess("PT-123456");
      expect(xml).toContain("<cas:proxySuccess>");
      expect(xml).toContain("<cas:proxyTicket>PT-123456</cas:proxyTicket>");
    });

    it("should build proxy error response", () => {
      const xml = buildProxyError("INVALID_REQUEST", "Invalid PGT");
      expect(xml).toContain('<cas:proxyFailure code="INVALID_REQUEST">');
      expect(xml).toContain("Invalid PGT");
    });
  });

  describe("SAML 1.0 validate responses", () => {
    it("should build SAML success response", () => {
      const xml = buildSamlValidateSuccess("dwho", {
        mail: ["dwho@example.com"],
      });
      expect(xml).toContain("SOAP-ENV:Envelope");
      expect(xml).toContain("saml1p:Response");
      expect(xml).toContain("saml1p:Success");
      expect(xml).toContain(
        "<saml1:NameIdentifier>dwho</saml1:NameIdentifier>",
      );
      expect(xml).toContain('AttributeName="mail"');
      expect(xml).toContain(
        "<saml1:AttributeValue>dwho@example.com</saml1:AttributeValue>",
      );
    });

    it("should include InResponseTo when requestId provided", () => {
      const xml = buildSamlValidateSuccess("dwho", {}, "_req123");
      expect(xml).toContain('InResponseTo="_req123"');
    });

    it("should build SAML error response", () => {
      const xml = buildSamlValidateError("INVALID_TICKET", "Ticket not found");
      expect(xml).toContain("SOAP-ENV:Envelope");
      expect(xml).toContain("saml1p:Response");
      expect(xml).toContain("saml1p:RequestDenied");
      expect(xml).toContain("INVALID_TICKET: Ticket not found");
    });

    it("should include InResponseTo in error when requestId provided", () => {
      const xml = buildSamlValidateError("ERROR", "message", "_req456");
      expect(xml).toContain('InResponseTo="_req456"');
    });
  });

  describe("SAML LogoutRequest", () => {
    it("should build logout request with session index", () => {
      const xml = buildLogoutRequest("session-123");
      expect(xml).toContain("samlp:LogoutRequest");
      expect(xml).toContain(
        "<samlp:SessionIndex>session-123</samlp:SessionIndex>",
      );
      expect(xml).toContain('Version="2.0"');
    });

    it("should escape session index", () => {
      const xml = buildLogoutRequest("<script>");
      expect(xml).toContain("&lt;script&gt;");
    });
  });
});
