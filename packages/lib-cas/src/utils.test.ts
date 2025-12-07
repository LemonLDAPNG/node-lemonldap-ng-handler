/**
 * Tests for CAS utilities
 */

import {
  isServiceUrlValid,
  extractServiceUrl,
  appendQueryParam,
  buildCasLoginUrl,
  buildCasLogoutUrl,
  buildValidateUrl,
  buildServiceValidateUrl,
  buildProxyValidateUrl,
  buildProxyUrl,
  buildSamlValidateUrl,
  normalizeCasServerUrl,
  parseServiceFromRequest,
  DEFAULT_TICKET_TTL,
  calculateExpiration,
  isExpired,
} from "./utils";

describe("CAS Utilities", () => {
  describe("isServiceUrlValid", () => {
    it("should match exact URL", () => {
      expect(
        isServiceUrlValid("http://app.example.com/login", [
          "http://app.example.com/login",
        ]),
      ).toBe(true);
    });

    it("should match prefix", () => {
      expect(
        isServiceUrlValid("http://app.example.com/path/to/resource", [
          "http://app.example.com",
        ]),
      ).toBe(true);
    });

    it("should match with wildcard in host", () => {
      expect(
        isServiceUrlValid("http://app1.example.com/login", [
          "http://*.example.com/login",
        ]),
      ).toBe(true);
      expect(
        isServiceUrlValid("http://other.domain.com/login", [
          "http://*.example.com/login",
        ]),
      ).toBe(false);
    });

    it("should match with wildcard in path", () => {
      expect(
        isServiceUrlValid("http://app.example.com/api/v1/users", [
          "http://app.example.com/api/*",
        ]),
      ).toBe(true);
    });

    it("should match any of multiple patterns", () => {
      expect(
        isServiceUrlValid("http://app2.example.com/login", [
          "http://app1.example.com",
          "http://app2.example.com",
          "http://app3.example.com",
        ]),
      ).toBe(true);
    });

    it("should reject non-matching URL", () => {
      expect(
        isServiceUrlValid("http://evil.com/login", ["http://app.example.com"]),
      ).toBe(false);
    });

    it("should reject empty inputs", () => {
      expect(isServiceUrlValid("", ["http://app.example.com"])).toBe(false);
      expect(isServiceUrlValid("http://app.example.com", [])).toBe(false);
    });

    it("should not match partial prefix without path boundary", () => {
      expect(
        isServiceUrlValid("http://app.example.com.evil.com", [
          "http://app.example.com",
        ]),
      ).toBe(false);
    });

    it("should match with query string", () => {
      expect(
        isServiceUrlValid("http://app.example.com?foo=bar", [
          "http://app.example.com",
        ]),
      ).toBe(true);
    });
  });

  describe("extractServiceUrl", () => {
    it("should remove ticket parameter", () => {
      expect(extractServiceUrl("http://app.com/login?ticket=ST-123")).toBe(
        "http://app.com/login",
      );
    });

    it("should preserve other parameters", () => {
      expect(
        extractServiceUrl("http://app.com/login?foo=bar&ticket=ST-123&baz=qux"),
      ).toBe("http://app.com/login?foo=bar&baz=qux");
    });

    it("should handle URL without ticket", () => {
      expect(extractServiceUrl("http://app.com/login?foo=bar")).toBe(
        "http://app.com/login?foo=bar",
      );
    });

    it("should handle URL without query params", () => {
      expect(extractServiceUrl("http://app.com/login")).toBe(
        "http://app.com/login",
      );
    });
  });

  describe("appendQueryParam", () => {
    it("should add first parameter", () => {
      expect(appendQueryParam("http://app.com/login", "ticket", "ST-123")).toBe(
        "http://app.com/login?ticket=ST-123",
      );
    });

    it("should append to existing parameters", () => {
      expect(
        appendQueryParam("http://app.com/login?foo=bar", "ticket", "ST-123"),
      ).toBe("http://app.com/login?foo=bar&ticket=ST-123");
    });

    it("should encode special characters", () => {
      expect(
        appendQueryParam("http://app.com/", "url", "http://other.com?a=b"),
      ).toBe("http://app.com/?url=http%3A%2F%2Fother.com%3Fa%3Db");
    });
  });

  describe("buildCasLoginUrl", () => {
    it("should build basic login URL", () => {
      const url = buildCasLoginUrl(
        "https://cas.example.com",
        "http://app.com/login",
      );
      expect(url).toBe(
        "https://cas.example.com/login?service=http%3A%2F%2Fapp.com%2Flogin",
      );
    });

    it("should add renew parameter", () => {
      const url = buildCasLoginUrl(
        "https://cas.example.com",
        "http://app.com",
        {
          renew: true,
        },
      );
      expect(url).toContain("&renew=true");
    });

    it("should add gateway parameter", () => {
      const url = buildCasLoginUrl(
        "https://cas.example.com",
        "http://app.com",
        {
          gateway: true,
        },
      );
      expect(url).toContain("&gateway=true");
    });
  });

  describe("buildCasLogoutUrl", () => {
    it("should build basic logout URL", () => {
      const url = buildCasLogoutUrl("https://cas.example.com");
      expect(url).toBe("https://cas.example.com/logout");
    });

    it("should add service parameter", () => {
      const url = buildCasLogoutUrl(
        "https://cas.example.com",
        "http://app.com/logged-out",
      );
      expect(url).toBe(
        "https://cas.example.com/logout?service=http%3A%2F%2Fapp.com%2Flogged-out",
      );
    });
  });

  describe("buildValidateUrl", () => {
    it("should build CAS 1.0 validate URL", () => {
      const url = buildValidateUrl(
        "https://cas.example.com",
        "http://app.com",
        "ST-123",
      );
      expect(url).toBe(
        "https://cas.example.com/validate?service=http%3A%2F%2Fapp.com&ticket=ST-123",
      );
    });
  });

  describe("buildServiceValidateUrl", () => {
    it("should build basic serviceValidate URL", () => {
      const url = buildServiceValidateUrl(
        "https://cas.example.com",
        "http://app.com",
        "ST-123",
      );
      expect(url).toBe(
        "https://cas.example.com/serviceValidate?service=http%3A%2F%2Fapp.com&ticket=ST-123",
      );
    });

    it("should use p3 endpoint when specified", () => {
      const url = buildServiceValidateUrl(
        "https://cas.example.com",
        "http://app.com",
        "ST-123",
        { p3: true },
      );
      expect(url).toContain("/p3/serviceValidate?");
    });

    it("should add pgtUrl parameter", () => {
      const url = buildServiceValidateUrl(
        "https://cas.example.com",
        "http://app.com",
        "ST-123",
        { pgtUrl: "http://app.com/pgt" },
      );
      expect(url).toContain("&pgtUrl=http%3A%2F%2Fapp.com%2Fpgt");
    });

    it("should add format parameter", () => {
      const url = buildServiceValidateUrl(
        "https://cas.example.com",
        "http://app.com",
        "ST-123",
        { format: "JSON" },
      );
      expect(url).toContain("&format=JSON");
    });
  });

  describe("buildProxyValidateUrl", () => {
    it("should build proxyValidate URL", () => {
      const url = buildProxyValidateUrl(
        "https://cas.example.com",
        "http://app.com",
        "PT-123",
      );
      expect(url).toBe(
        "https://cas.example.com/proxyValidate?service=http%3A%2F%2Fapp.com&ticket=PT-123",
      );
    });

    it("should use p3 endpoint when specified", () => {
      const url = buildProxyValidateUrl(
        "https://cas.example.com",
        "http://app.com",
        "PT-123",
        { p3: true },
      );
      expect(url).toContain("/p3/proxyValidate?");
    });
  });

  describe("buildProxyUrl", () => {
    it("should build proxy URL", () => {
      const url = buildProxyUrl(
        "https://cas.example.com",
        "PGT-123",
        "http://target.com",
      );
      expect(url).toBe(
        "https://cas.example.com/proxy?pgt=PGT-123&targetService=http%3A%2F%2Ftarget.com",
      );
    });
  });

  describe("buildSamlValidateUrl", () => {
    it("should build samlValidate URL", () => {
      const url = buildSamlValidateUrl(
        "https://cas.example.com",
        "http://app.com",
      );
      expect(url).toBe(
        "https://cas.example.com/samlValidate?TARGET=http%3A%2F%2Fapp.com",
      );
    });
  });

  describe("normalizeCasServerUrl", () => {
    it("should remove trailing slash", () => {
      expect(normalizeCasServerUrl("https://cas.example.com/")).toBe(
        "https://cas.example.com",
      );
    });

    it("should remove multiple trailing slashes", () => {
      expect(normalizeCasServerUrl("https://cas.example.com///")).toBe(
        "https://cas.example.com",
      );
    });

    it("should not modify URL without trailing slash", () => {
      expect(normalizeCasServerUrl("https://cas.example.com")).toBe(
        "https://cas.example.com",
      );
    });
  });

  describe("parseServiceFromRequest", () => {
    it("should return service parameter", () => {
      expect(parseServiceFromRequest({ service: "http://app.com" })).toBe(
        "http://app.com",
      );
    });

    it("should return TARGET parameter", () => {
      expect(parseServiceFromRequest({ TARGET: "http://app.com" })).toBe(
        "http://app.com",
      );
    });

    it("should prefer service over TARGET", () => {
      expect(
        parseServiceFromRequest({
          service: "http://service.com",
          TARGET: "http://target.com",
        }),
      ).toBe("http://service.com");
    });

    it("should return null if neither present", () => {
      expect(parseServiceFromRequest({})).toBeNull();
    });
  });

  describe("DEFAULT_TICKET_TTL", () => {
    it("should have reasonable default values", () => {
      expect(DEFAULT_TICKET_TTL.ST).toBe(5 * 60 * 1000); // 5 minutes
      expect(DEFAULT_TICKET_TTL.PT).toBe(5 * 60 * 1000); // 5 minutes
      expect(DEFAULT_TICKET_TTL.PGT).toBe(2 * 60 * 60 * 1000); // 2 hours
    });
  });

  describe("calculateExpiration", () => {
    it("should calculate future timestamp", () => {
      const now = Date.now();
      const expiration = calculateExpiration(60000); // 1 minute
      expect(expiration).toBeGreaterThan(now);
      expect(expiration).toBeLessThanOrEqual(now + 60000 + 100); // Allow small margin
    });
  });

  describe("isExpired", () => {
    it("should return true for past timestamp", () => {
      expect(isExpired(Date.now() - 1000)).toBe(true);
    });

    it("should return false for future timestamp", () => {
      expect(isExpired(Date.now() + 60000)).toBe(false);
    });
  });
});
