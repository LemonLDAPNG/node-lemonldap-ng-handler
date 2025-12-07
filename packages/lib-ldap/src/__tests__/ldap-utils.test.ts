import {
  escapeFilterValue,
  escapeDnValue,
  buildFilter,
  parseLDAPUrl,
  parseLDAPUrls,
  getLdapValue,
  getLdapValues,
  convertDerefOption,
  mapPpolicyError,
} from "../ldap-utils";

describe("ldap-utils", () => {
  describe("escapeFilterValue", () => {
    it("should escape backslash", () => {
      expect(escapeFilterValue("test\\value")).toBe("test\\5cvalue");
    });

    it("should escape asterisk", () => {
      expect(escapeFilterValue("test*value")).toBe("test\\2avalue");
    });

    it("should escape parentheses", () => {
      expect(escapeFilterValue("test(value)")).toBe("test\\28value\\29");
    });

    it("should escape null character", () => {
      expect(escapeFilterValue("test\0value")).toBe("test\\00value");
    });

    it("should escape multiple special characters", () => {
      expect(escapeFilterValue("a*b(c)d\\e")).toBe("a\\2ab\\28c\\29d\\5ce");
    });

    it("should not modify safe strings", () => {
      expect(escapeFilterValue("testvalue")).toBe("testvalue");
    });
  });

  describe("escapeDnValue", () => {
    it("should escape comma", () => {
      expect(escapeDnValue("test,value")).toBe("test\\,value");
    });

    it("should escape equals sign", () => {
      expect(escapeDnValue("test=value")).toBe("test\\=value");
    });

    it("should escape plus sign", () => {
      expect(escapeDnValue("test+value")).toBe("test\\+value");
    });
  });

  describe("buildFilter", () => {
    it("should replace $user with escaped username", () => {
      const filter = buildFilter("(uid=$user)", "testuser");
      expect(filter).toBe("(uid=testuser)");
    });

    it("should escape special characters in username", () => {
      const filter = buildFilter("(uid=$user)", "test*user");
      expect(filter).toBe("(uid=test\\2auser)");
    });

    it("should handle complex filters", () => {
      const filter = buildFilter(
        "(&(uid=$user)(objectClass=inetOrgPerson))",
        "john",
      );
      expect(filter).toBe("(&(uid=john)(objectClass=inetOrgPerson))");
    });

    it("should replace multiple $user occurrences", () => {
      const filter = buildFilter(
        "(|(uid=$user)(mail=$user@example.com))",
        "john",
      );
      expect(filter).toBe("(|(uid=john)(mail=john@example.com))");
    });
  });

  describe("parseLDAPUrl", () => {
    it("should parse ldap:// URL with default port", () => {
      const result = parseLDAPUrl("ldap://localhost");
      expect(result).toEqual({
        protocol: "ldap",
        host: "localhost",
        port: 389,
        useTLS: false,
        useStartTLS: false,
      });
    });

    it("should parse ldap:// URL with custom port", () => {
      const result = parseLDAPUrl("ldap://localhost:3890");
      expect(result).toEqual({
        protocol: "ldap",
        host: "localhost",
        port: 3890,
        useTLS: false,
        useStartTLS: false,
      });
    });

    it("should parse ldaps:// URL", () => {
      const result = parseLDAPUrl("ldaps://ldap.example.com");
      expect(result).toEqual({
        protocol: "ldaps",
        host: "ldap.example.com",
        port: 636,
        useTLS: true,
        useStartTLS: false,
      });
    });

    it("should parse ldap+tls:// URL", () => {
      const result = parseLDAPUrl("ldap+tls://localhost:389");
      expect(result).toEqual({
        protocol: "ldap+tls",
        host: "localhost",
        port: 389,
        useTLS: false,
        useStartTLS: true,
      });
    });

    it("should throw on invalid URL", () => {
      expect(() => parseLDAPUrl("invalid")).toThrow("Invalid LDAP URL");
    });
  });

  describe("parseLDAPUrls", () => {
    it("should parse single URL", () => {
      const results = parseLDAPUrls("ldap://localhost:389");
      expect(results).toHaveLength(1);
      expect(results[0].host).toBe("localhost");
    });

    it("should parse comma-separated URLs", () => {
      const results = parseLDAPUrls("ldap://server1:389,ldap://server2:389");
      expect(results).toHaveLength(2);
      expect(results[0].host).toBe("server1");
      expect(results[1].host).toBe("server2");
    });

    it("should parse space-separated URLs", () => {
      const results = parseLDAPUrls("ldap://server1:389 ldap://server2:389");
      expect(results).toHaveLength(2);
    });
  });

  describe("getLdapValue", () => {
    it("should return string value", () => {
      const entry = { dn: "uid=test", cn: "Test User" };
      expect(getLdapValue(entry, "cn")).toBe("Test User");
    });

    it("should join array values with separator", () => {
      const entry = { dn: "uid=test", mail: ["a@test.com", "b@test.com"] };
      expect(getLdapValue(entry, "mail")).toBe("a@test.com;b@test.com");
    });

    it("should use custom separator", () => {
      const entry = { dn: "uid=test", mail: ["a@test.com", "b@test.com"] };
      expect(getLdapValue(entry, "mail", ",")).toBe("a@test.com,b@test.com");
    });

    it("should return empty string for missing attribute", () => {
      const entry = { dn: "uid=test" };
      expect(getLdapValue(entry, "cn")).toBe("");
    });

    it("should return DN for 'dn' attribute", () => {
      const entry = { dn: "uid=test,dc=example,dc=com", cn: "Test" };
      expect(getLdapValue(entry, "dn")).toBe("uid=test,dc=example,dc=com");
    });
  });

  describe("getLdapValues", () => {
    it("should return array for single value", () => {
      const entry = { dn: "uid=test", cn: "Test User" };
      expect(getLdapValues(entry, "cn")).toEqual(["Test User"]);
    });

    it("should return array as-is", () => {
      const entry = { dn: "uid=test", mail: ["a@test.com", "b@test.com"] };
      expect(getLdapValues(entry, "mail")).toEqual([
        "a@test.com",
        "b@test.com",
      ]);
    });

    it("should return empty array for missing attribute", () => {
      const entry = { dn: "uid=test" };
      expect(getLdapValues(entry, "cn")).toEqual([]);
    });
  });

  describe("convertDerefOption", () => {
    it("should return valid options as-is", () => {
      expect(convertDerefOption("never")).toBe("never");
      expect(convertDerefOption("search")).toBe("search");
      expect(convertDerefOption("find")).toBe("find");
      expect(convertDerefOption("always")).toBe("always");
    });

    it("should be case insensitive", () => {
      expect(convertDerefOption("NEVER")).toBe("never");
      expect(convertDerefOption("Always")).toBe("always");
    });

    it("should default to 'find'", () => {
      expect(convertDerefOption(undefined)).toBe("find");
      expect(convertDerefOption("invalid")).toBe("find");
    });
  });

  describe("mapPpolicyError", () => {
    it("should map known error codes", () => {
      expect(mapPpolicyError(0)).toBe("PE_PP_PASSWORD_EXPIRED");
      expect(mapPpolicyError(1)).toBe("PE_PP_ACCOUNT_LOCKED");
      expect(mapPpolicyError(2)).toBe("PE_PP_CHANGE_AFTER_RESET");
      expect(mapPpolicyError(6)).toBe("PE_PP_PASSWORD_TOO_SHORT");
    });

    it("should return PE_LDAPERROR for unknown codes", () => {
      expect(mapPpolicyError(99)).toBe("PE_LDAPERROR");
    });
  });
});
