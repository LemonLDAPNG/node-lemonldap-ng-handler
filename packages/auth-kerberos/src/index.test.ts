import { KerberosAuth, Logger } from "./index";
import { Request, Response } from "express";

// Mock logger
const createLogger = (): Logger => ({
  error: jest.fn(),
  warn: jest.fn(),
  notice: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

// Mock request factory
function createMockRequest(headers: Record<string, string> = {}): Request {
  return {
    headers,
  } as unknown as Request;
}

// Mock response factory
function createMockResponse(): Response {
  const res = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

describe("KerberosAuth", () => {
  let auth: KerberosAuth;
  let logger: Logger;

  beforeEach(() => {
    auth = new KerberosAuth();
    logger = createLogger();
  });

  describe("init", () => {
    it("should initialize without kerberos library", async () => {
      await auth.init({}, logger);

      // Skip assertions if kerberos is actually available
      if (auth.isAvailable()) {
        return;
      }

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("not available"),
      );
      expect(auth.isAvailable()).toBe(false);
    });

    it("should parse comma-separated allowed domains", async () => {
      await auth.init({ krbAllowedDomains: "REALM1.COM, REALM2.COM" }, logger);

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("REALM1.COM"),
      );
    });

    it("should parse array allowed domains", async () => {
      await auth.init(
        { krbAllowedDomains: ["realm1.com", "realm2.com"] },
        logger,
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("REALM1.COM"),
      );
    });

    it("should set KRB5_KTNAME when keytab is specified", async () => {
      const originalEnv = process.env.KRB5_KTNAME;

      await auth.init({ krbKeytab: "/etc/krb5.keytab" }, logger);

      expect(process.env.KRB5_KTNAME).toBe("/etc/krb5.keytab");
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("/etc/krb5.keytab"),
      );

      // Restore
      if (originalEnv) {
        process.env.KRB5_KTNAME = originalEnv;
      } else {
        delete process.env.KRB5_KTNAME;
      }
    });
  });

  describe("extractToken", () => {
    beforeEach(async () => {
      await auth.init({}, logger);
    });

    it("should extract token from Negotiate header", () => {
      const req = createMockRequest({
        authorization: "Negotiate YIIBhgYJKoZIhvcSAQ==",
      });

      const token = auth.extractToken(req);

      expect(token).toBe("YIIBhgYJKoZIhvcSAQ==");
    });

    it("should return null for missing header", () => {
      const req = createMockRequest({});

      const token = auth.extractToken(req);

      expect(token).toBeNull();
    });

    it("should return null for non-Negotiate auth", () => {
      const req = createMockRequest({
        authorization: "Basic dXNlcjpwYXNz",
      });

      const token = auth.extractToken(req);

      expect(token).toBeNull();
    });

    it("should handle case-insensitive Negotiate", () => {
      const req = createMockRequest({
        authorization: "NEGOTIATE YIIBhgYJKoZIhvcSAQ==",
      });

      const token = auth.extractToken(req);

      expect(token).toBe("YIIBhgYJKoZIhvcSAQ==");
    });
  });

  describe("parseUsername", () => {
    beforeEach(async () => {
      await auth.init({}, logger);
    });

    it("should parse user@REALM format", () => {
      const result = auth.parseUsername("dwho@GALLIFREY.LOCAL");

      expect(result.user).toBe("dwho");
      expect(result.realm).toBe("GALLIFREY.LOCAL");
    });

    it("should handle username without realm", () => {
      const result = auth.parseUsername("dwho");

      expect(result.user).toBe("dwho");
      expect(result.realm).toBeNull();
    });

    it("should handle email-like usernames", () => {
      const result = auth.parseUsername("dwho@example.com@REALM.LOCAL");

      expect(result.user).toBe("dwho@example.com");
      expect(result.realm).toBe("REALM.LOCAL");
    });
  });

  describe("getFinalUsername", () => {
    it("should remove domain by default", async () => {
      await auth.init({}, logger);

      const result = auth.getFinalUsername("dwho@GALLIFREY.LOCAL");

      expect(result.user).toBe("dwho");
      expect(result.realm).toBe("GALLIFREY.LOCAL");
    });

    it("should keep domain when krbRemoveDomain is false", async () => {
      await auth.init({ krbRemoveDomain: false }, logger);

      const result = auth.getFinalUsername("dwho@GALLIFREY.LOCAL");

      expect(result.user).toBe("dwho@GALLIFREY.LOCAL");
      expect(result.realm).toBe("GALLIFREY.LOCAL");
    });
  });

  describe("isRealmAllowed", () => {
    it("should allow all realms when no restrictions", async () => {
      await auth.init({}, logger);

      expect(auth.isRealmAllowed("ANY.REALM")).toBe(true);
    });

    it("should filter by allowed domains", async () => {
      await auth.init({ krbAllowedDomains: ["GALLIFREY.LOCAL"] }, logger);

      expect(auth.isRealmAllowed("GALLIFREY.LOCAL")).toBe(true);
      expect(auth.isRealmAllowed("EARTH.LOCAL")).toBe(false);
    });

    it("should be case-insensitive", async () => {
      await auth.init({ krbAllowedDomains: ["gallifrey.local"] }, logger);

      expect(auth.isRealmAllowed("GALLIFREY.LOCAL")).toBe(true);
      expect(auth.isRealmAllowed("Gallifrey.Local")).toBe(true);
    });
  });

  describe("authenticate", () => {
    it("should return error when kerberos library not available", async () => {
      await auth.init({}, logger);

      // Skip test if kerberos is actually available
      if (auth.isAvailable()) {
        return;
      }

      const req = createMockRequest({
        authorization: "Negotiate token",
      });

      const result = await auth.authenticate(req);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("PE_ERROR");
      expect(result.error).toContain("not available");
    });

    it("should return PE_SENDRESPONSE when no token provided", async () => {
      // Manually set kerberos as available for this test
      const authWithKerberos = new KerberosAuth();
      await authWithKerberos.init({}, logger);
      // @ts-expect-error - accessing private property for testing
      authWithKerberos.kerberos = {}; // Mock as available

      const req = createMockRequest({});

      const result = await authWithKerberos.authenticate(req);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("PE_SENDRESPONSE");
    });
  });

  describe("sendNegotiateChallenge", () => {
    beforeEach(async () => {
      await auth.init({}, logger);
    });

    it("should send WWW-Authenticate: Negotiate header", () => {
      const res = createMockResponse();

      auth.sendNegotiateChallenge(res);

      expect(res.setHeader).toHaveBeenCalledWith(
        "WWW-Authenticate",
        "Negotiate",
      );
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should include response token when provided", () => {
      const res = createMockResponse();

      auth.sendNegotiateChallenge(res, "responseToken123");

      expect(res.setHeader).toHaveBeenCalledWith(
        "WWW-Authenticate",
        "Negotiate responseToken123",
      );
    });
  });

  describe("getAuthenticationLevel", () => {
    it("should return default level 3", async () => {
      await auth.init({}, logger);

      expect(auth.getAuthenticationLevel()).toBe(3);
    });

    it("should return configured level", async () => {
      await auth.init({ KrbAuthnLevel: 5 }, logger);

      expect(auth.getAuthenticationLevel()).toBe(5);
    });
  });

  describe("isJsEnabled", () => {
    it("should return false by default", async () => {
      await auth.init({}, logger);

      expect(auth.isJsEnabled()).toBe(false);
    });

    it("should return true when configured", async () => {
      await auth.init({ krbByJs: true }, logger);

      expect(auth.isJsEnabled()).toBe(true);
    });
  });

  describe("close", () => {
    it("should close without error", async () => {
      await auth.init({}, logger);

      await expect(auth.close()).resolves.toBeUndefined();
    });
  });
});

describe("KerberosAuth with mock GSSAPI", () => {
  let auth: KerberosAuth;
  let logger: Logger;

  // Mock GSSAPI response
  const mockUsername = "dwho@GALLIFREY.LOCAL";
  const mockResponseToken = "responseToken123";

  beforeEach(async () => {
    auth = new KerberosAuth();
    logger = createLogger();
    await auth.init({}, logger);

    // Mock the kerberos module
    const mockCtx = {
      username: mockUsername,
      step: jest.fn((token, callback) => {
        callback(null, mockResponseToken);
      }),
    };

    // @ts-expect-error - accessing private property for testing
    auth.kerberos = {
      initializeServer: jest.fn((service, callback) => {
        callback(null, mockCtx);
      }),
    };
  });

  it("should authenticate with valid token", async () => {
    const req = createMockRequest({
      authorization: "Negotiate validToken123",
    });

    const result = await auth.authenticate(req);

    expect(result.success).toBe(true);
    expect(result.user).toBe("dwho");
    expect(result.realm).toBe("GALLIFREY.LOCAL");
    expect(result.authenticationLevel).toBe(3);
    expect(result.responseToken).toBe(mockResponseToken);
  });

  it("should reject realm not in allowed list", async () => {
    // Reinit with allowed domains
    await auth.init({ krbAllowedDomains: ["EARTH.LOCAL"] }, logger);

    // Re-mock kerberos
    const mockCtx = {
      username: mockUsername,
      step: jest.fn((token, callback) => {
        callback(null, mockResponseToken);
      }),
    };
    // @ts-expect-error - accessing private property for testing
    auth.kerberos = {
      initializeServer: jest.fn((service, callback) => {
        callback(null, mockCtx);
      }),
    };

    const req = createMockRequest({
      authorization: "Negotiate validToken123",
    });

    const result = await auth.authenticate(req);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("PE_BADCREDENTIALS");
    expect(result.error).toContain("not allowed");
  });

  it("should handle GSSAPI initialization error", async () => {
    // @ts-expect-error - accessing private property for testing
    auth.kerberos = {
      initializeServer: jest.fn((service, callback) => {
        callback(new Error("Keytab not found"), null);
      }),
    };

    const req = createMockRequest({
      authorization: "Negotiate validToken123",
    });

    const result = await auth.authenticate(req);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("PE_ERROR");
  });

  it("should handle GSSAPI step error", async () => {
    const mockCtx = {
      username: "",
      step: jest.fn((token, callback) => {
        callback(new Error("Invalid token"), null);
      }),
    };
    // @ts-expect-error - accessing private property for testing
    auth.kerberos = {
      initializeServer: jest.fn((service, callback) => {
        callback(null, mockCtx);
      }),
    };

    const req = createMockRequest({
      authorization: "Negotiate invalidToken",
    });

    const result = await auth.authenticate(req);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("PE_BADCREDENTIALS");
  });
});
