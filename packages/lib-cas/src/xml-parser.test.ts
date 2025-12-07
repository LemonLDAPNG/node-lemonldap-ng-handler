/**
 * Tests for CAS XML parsing
 */

import {
  parseSamlValidateRequest,
  parseServiceValidateResponse,
  parseValidateResponse,
  parseSamlValidateResponse,
  parseProxyResponse,
} from "./xml-parser";
import {
  buildServiceValidateSuccess,
  buildServiceValidateError,
  buildSamlValidateSuccess,
  buildSamlValidateError,
  buildProxySuccess,
  buildProxyError,
} from "./xml-builder";

describe("CAS XML Parser", () => {
  describe("parseSamlValidateRequest", () => {
    it("should parse SAML validate request", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <saml1p:Request xmlns:saml1p="urn:oasis:names:tc:SAML:1.0:protocol" RequestID="_req123" IssueInstant="2024-01-01T00:00:00Z">
      <saml1p:AssertionArtifact>ST-12345</saml1p:AssertionArtifact>
    </saml1p:Request>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

      const result = parseSamlValidateRequest(xml);
      expect(result).not.toBeNull();
      expect(result?.ticket).toBe("ST-12345");
      expect(result?.requestId).toBe("_req123");
      expect(result?.issueInstant).toBe("2024-01-01T00:00:00Z");
    });

    it("should parse request without RequestID", () => {
      const xml = `<SOAP-ENV:Envelope><SOAP-ENV:Body>
        <saml1p:Request><saml1p:AssertionArtifact>ST-xyz</saml1p:AssertionArtifact></saml1p:Request>
      </SOAP-ENV:Body></SOAP-ENV:Envelope>`;

      const result = parseSamlValidateRequest(xml);
      expect(result).not.toBeNull();
      expect(result?.ticket).toBe("ST-xyz");
      expect(result?.requestId).toBeUndefined();
    });

    it("should return null for invalid request", () => {
      expect(parseSamlValidateRequest("")).toBeNull();
      expect(parseSamlValidateRequest("<invalid>")).toBeNull();
      expect(
        parseSamlValidateRequest("<SOAP-ENV:Envelope></SOAP-ENV:Envelope>"),
      ).toBeNull();
    });
  });

  describe("parseServiceValidateResponse", () => {
    it("should parse success response with user only", () => {
      const xml = buildServiceValidateSuccess("dwho");
      const result = parseServiceValidateResponse(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user).toBe("dwho");
        expect(result.attributes).toBeUndefined();
        expect(result.pgtIou).toBeUndefined();
      }
    });

    it("should parse success response with attributes", () => {
      const xml = buildServiceValidateSuccess("dwho", {
        mail: ["dwho@example.com"],
        groups: ["admin", "users"],
      });
      const result = parseServiceValidateResponse(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user).toBe("dwho");
        expect(result.attributes).toBeDefined();
        expect(result.attributes?.mail).toEqual(["dwho@example.com"]);
        expect(result.attributes?.groups).toEqual(["admin", "users"]);
      }
    });

    it("should parse success response with PGTIOU", () => {
      const xml = buildServiceValidateSuccess(
        "dwho",
        undefined,
        "PGTIOU-abc123",
      );
      const result = parseServiceValidateResponse(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.pgtIou).toBe("PGTIOU-abc123");
      }
    });

    it("should parse success response with proxies", () => {
      const xml = buildServiceValidateSuccess("dwho", undefined, undefined, [
        "https://proxy1.com",
        "https://proxy2.com",
      ]);
      const result = parseServiceValidateResponse(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.proxies).toEqual([
          "https://proxy1.com",
          "https://proxy2.com",
        ]);
      }
    });

    it("should parse error response", () => {
      const xml = buildServiceValidateError(
        "INVALID_TICKET",
        "Ticket not found",
      );
      const result = parseServiceValidateResponse(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_TICKET");
        expect(result.message).toBe("Ticket not found");
      }
    });

    it("should handle empty response", () => {
      const result = parseServiceValidateResponse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_RESPONSE");
      }
    });

    it("should handle response without user", () => {
      const xml = `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
        <cas:authenticationSuccess></cas:authenticationSuccess>
      </cas:serviceResponse>`;
      const result = parseServiceValidateResponse(xml);
      expect(result.success).toBe(false);
    });

    it("should unescape XML entities", () => {
      const xml = `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
        <cas:authenticationSuccess>
          <cas:user>test&amp;user</cas:user>
          <cas:attributes>
            <cas:name>&lt;value&gt;</cas:name>
          </cas:attributes>
        </cas:authenticationSuccess>
      </cas:serviceResponse>`;
      const result = parseServiceValidateResponse(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user).toBe("test&user");
        expect(result.attributes?.name).toEqual(["<value>"]);
      }
    });
  });

  describe("parseValidateResponse (CAS 1.0)", () => {
    it("should parse success response", () => {
      const result = parseValidateResponse("yes\ndwho\n");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user).toBe("dwho");
      }
    });

    it("should parse failure response", () => {
      const result = parseValidateResponse("no\n\n");
      expect(result.success).toBe(false);
    });

    it("should handle empty response", () => {
      const result = parseValidateResponse("");
      expect(result.success).toBe(false);
    });

    it("should trim whitespace from username", () => {
      const result = parseValidateResponse("yes\n  dwho  \n");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user).toBe("dwho");
      }
    });
  });

  describe("parseSamlValidateResponse", () => {
    it("should parse SAML success response", () => {
      const xml = buildSamlValidateSuccess("dwho", {
        mail: ["dwho@example.com"],
      });
      const result = parseSamlValidateResponse(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user).toBe("dwho");
        expect(result.attributes?.mail).toEqual(["dwho@example.com"]);
      }
    });

    it("should parse SAML success response with multiple attribute values", () => {
      const xml = buildSamlValidateSuccess("dwho", {
        groups: ["admin", "users", "developers"],
      });
      const result = parseSamlValidateResponse(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.attributes?.groups).toEqual([
          "admin",
          "users",
          "developers",
        ]);
      }
    });

    it("should parse SAML error response", () => {
      const xml = buildSamlValidateError("INVALID_TICKET", "Ticket not found");
      const result = parseSamlValidateResponse(xml);
      expect(result.success).toBe(false);
    });

    it("should handle empty response", () => {
      const result = parseSamlValidateResponse("");
      expect(result.success).toBe(false);
    });
  });

  describe("parseProxyResponse", () => {
    it("should parse proxy success response", () => {
      const xml = buildProxySuccess("PT-12345");
      const result = parseProxyResponse(xml);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.proxyTicket).toBe("PT-12345");
      }
    });

    it("should parse proxy error response", () => {
      const xml = buildProxyError("INVALID_REQUEST", "Invalid PGT");
      const result = parseProxyResponse(xml);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_REQUEST");
        expect(result.message).toBe("Invalid PGT");
      }
    });

    it("should handle empty response", () => {
      const result = parseProxyResponse("");
      expect(result.success).toBe(false);
    });

    it("should handle response without proxy ticket", () => {
      const xml = `<cas:serviceResponse xmlns:cas="http://www.yale.edu/tp/cas">
        <cas:proxySuccess></cas:proxySuccess>
      </cas:serviceResponse>`;
      const result = parseProxyResponse(xml);
      expect(result.success).toBe(false);
    });
  });
});
