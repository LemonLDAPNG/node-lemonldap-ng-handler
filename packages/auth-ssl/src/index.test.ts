import { SSLAuth, Logger } from "./index";
import { Request } from "express";

// Mock logger
const createLogger = (): Logger => ({
  error: jest.fn(),
  warn: jest.fn(),
  notice: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

// Mock request factory
function createMockRequest(
  sslEnv: Record<string, string> = {},
  headers: Record<string, string> = {},
): Request {
  return {
    headers,
    sslEnv, // Custom property for SSL env
  } as unknown as Request;
}

describe("SSLAuth", () => {
  let auth: SSLAuth;
  let logger: Logger;

  beforeEach(() => {
    auth = new SSLAuth();
    logger = createLogger();
    // Clear process.env SSL vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SSL_CLIENT_") || key.startsWith("SSL_SERVER_")) {
        delete process.env[key];
      }
    }
  });

  describe("init", () => {
    it("should initialize with default config", async () => {
      await auth.init({}, logger);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("SSL_CLIENT_S_DN_Email"),
      );
    });

    it("should initialize with custom SSLVar", async () => {
      await auth.init({ SSLVar: "SSL_CLIENT_S_DN_CN" }, logger);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("SSL_CLIENT_S_DN_CN"),
      );
    });

    it("should log SSLVarIf mappings count", async () => {
      await auth.init(
        {
          SSLVarIf: {
            CA1: "SSL_CLIENT_S_DN_CN",
            CA2: "SSL_CLIENT_S_DN_UID",
          },
        },
        logger,
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("2 issuer-based"),
      );
    });
  });

  describe("authenticate", () => {
    describe("basic authentication", () => {
      it("should authenticate with Email from certificate", async () => {
        await auth.init({}, logger);

        const req = createMockRequest({
          SSL_CLIENT_S_DN_Email: "dwho@example.com",
          SSL_CLIENT_VERIFY: "SUCCESS",
        });

        const result = await auth.authenticate(req);

        expect(result.success).toBe(true);
        expect(result.user).toBe("dwho@example.com");
        expect(result.authenticationLevel).toBe(5);
      });

      it("should authenticate with CN when configured", async () => {
        await auth.init({ SSLVar: "SSL_CLIENT_S_DN_CN" }, logger);

        const req = createMockRequest({
          SSL_CLIENT_S_DN_CN: "Doctor Who",
          SSL_CLIENT_S_DN_Email: "dwho@example.com",
          SSL_CLIENT_VERIFY: "SUCCESS",
        });

        const result = await auth.authenticate(req);

        expect(result.success).toBe(true);
        expect(result.user).toBe("Doctor Who");
      });

      it("should authenticate with UID when configured", async () => {
        await auth.init({ SSLVar: "SSL_CLIENT_S_DN_UID" }, logger);

        const req = createMockRequest({
          SSL_CLIENT_S_DN_UID: "dwho",
          SSL_CLIENT_S_DN_Email: "dwho@example.com",
          SSL_CLIENT_VERIFY: "SUCCESS",
        });

        const result = await auth.authenticate(req);

        expect(result.success).toBe(true);
        expect(result.user).toBe("dwho");
      });

      it("should use custom authentication level", async () => {
        await auth.init({ SSLAuthnLevel: 10 }, logger);

        const req = createMockRequest({
          SSL_CLIENT_S_DN_Email: "dwho@example.com",
          SSL_CLIENT_VERIFY: "SUCCESS",
        });

        const result = await auth.authenticate(req);

        expect(result.success).toBe(true);
        expect(result.authenticationLevel).toBe(10);
      });
    });

    describe("SSLVarIf - issuer-based field selection", () => {
      it("should use different field based on issuer", async () => {
        await auth.init(
          {
            SSLVar: "SSL_CLIENT_S_DN_Email",
            SSLVarIf: {
              "O=Gallifrey": "SSL_CLIENT_S_DN_CN",
              "O=Earth": "SSL_CLIENT_S_DN_UID",
            },
          },
          logger,
        );

        // Test with Gallifrey issuer -> use CN
        const req1 = createMockRequest({
          SSL_CLIENT_S_DN_CN: "Doctor Who",
          SSL_CLIENT_S_DN_Email: "dwho@example.com",
          SSL_CLIENT_S_DN_UID: "dwho",
          SSL_CLIENT_I_DN: "CN=Gallifrey CA, O=Gallifrey",
          SSL_CLIENT_VERIFY: "SUCCESS",
        });

        const result1 = await auth.authenticate(req1);
        expect(result1.success).toBe(true);
        expect(result1.user).toBe("Doctor Who");
        expect(result1.issuer).toBe("CN=Gallifrey CA, O=Gallifrey");

        // Test with Earth issuer -> use UID
        const req2 = createMockRequest({
          SSL_CLIENT_S_DN_CN: "Rose Tyler",
          SSL_CLIENT_S_DN_Email: "rtyler@example.com",
          SSL_CLIENT_S_DN_UID: "rtyler",
          SSL_CLIENT_I_DN: "CN=Earth CA, O=Earth",
          SSL_CLIENT_VERIFY: "SUCCESS",
        });

        const result2 = await auth.authenticate(req2);
        expect(result2.success).toBe(true);
        expect(result2.user).toBe("rtyler");
        expect(result2.issuer).toBe("CN=Earth CA, O=Earth");

        // Test with unknown issuer -> use default (Email)
        const req3 = createMockRequest({
          SSL_CLIENT_S_DN_CN: "Mickey Smith",
          SSL_CLIENT_S_DN_Email: "msmith@example.com",
          SSL_CLIENT_S_DN_UID: "msmith",
          SSL_CLIENT_I_DN: "CN=Unknown CA, O=Unknown",
          SSL_CLIENT_VERIFY: "SUCCESS",
        });

        const result3 = await auth.authenticate(req3);
        expect(result3.success).toBe(true);
        expect(result3.user).toBe("msmith@example.com");
      });
    });

    describe("error handling", () => {
      it("should fail when no certificate provided", async () => {
        await auth.init({}, logger);

        const req = createMockRequest({});

        const result = await auth.authenticate(req);

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe("PE_CERTIFICATEREQUIRED");
      });

      it("should fail when verification failed", async () => {
        await auth.init({}, logger);

        const req = createMockRequest({
          SSL_CLIENT_S_DN_Email: "dwho@example.com",
          SSL_CLIENT_VERIFY: "FAILED",
        });

        const result = await auth.authenticate(req);

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe("PE_CERTIFICATEREQUIRED");
        expect(result.error).toContain("verification failed");
      });

      it("should fail when user field is empty", async () => {
        await auth.init({}, logger);

        const req = createMockRequest({
          SSL_CLIENT_S_DN_CN: "Doctor Who", // Has CN but not Email
          SSL_CLIENT_VERIFY: "SUCCESS",
        });

        const result = await auth.authenticate(req);

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe("PE_CERTIFICATEREQUIRED");
      });
    });

    describe("SSL env from different sources", () => {
      it("should read from process.env", async () => {
        process.env.SSL_CLIENT_S_DN_Email = "env@example.com";
        process.env.SSL_CLIENT_VERIFY = "SUCCESS";

        await auth.init({}, logger);

        const req = createMockRequest({});

        const result = await auth.authenticate(req);

        expect(result.success).toBe(true);
        expect(result.user).toBe("env@example.com");
      });

      it("should read from request headers", async () => {
        await auth.init({}, logger);

        const req = createMockRequest(
          {},
          {
            "ssl-client-s-dn-email": "header@example.com",
            "ssl-client-verify": "SUCCESS",
          },
        );

        const result = await auth.authenticate(req);

        expect(result.success).toBe(true);
        expect(result.user).toBe("header@example.com");
      });

      it("should read from x-ssl-* headers", async () => {
        await auth.init({}, logger);

        const req = createMockRequest(
          {},
          {
            "x-ssl-client-s-dn-email": "xheader@example.com",
            "x-ssl-client-verify": "SUCCESS",
          },
        );

        const result = await auth.authenticate(req);

        expect(result.success).toBe(true);
        expect(result.user).toBe("xheader@example.com");
      });

      it("should prefer sslEnv property over process.env", async () => {
        process.env.SSL_CLIENT_S_DN_Email = "env@example.com";
        process.env.SSL_CLIENT_VERIFY = "SUCCESS";

        await auth.init({}, logger);

        const req = createMockRequest({
          SSL_CLIENT_S_DN_Email: "sslenv@example.com",
          SSL_CLIENT_VERIFY: "SUCCESS",
        });

        const result = await auth.authenticate(req);

        expect(result.success).toBe(true);
        expect(result.user).toBe("sslenv@example.com");
      });
    });

    describe("NONE verification (optional client cert)", () => {
      it("should succeed with NONE verification when user is present", async () => {
        await auth.init({}, logger);

        const req = createMockRequest({
          SSL_CLIENT_S_DN_Email: "dwho@example.com",
          SSL_CLIENT_VERIFY: "NONE",
        });

        const result = await auth.authenticate(req);

        // NONE means no verification was done - still works if user field is present
        expect(result.success).toBe(true);
        expect(result.user).toBe("dwho@example.com");
      });
    });
  });

  describe("getAuthenticationLevel", () => {
    it("should return default level 5", async () => {
      await auth.init({}, logger);
      expect(auth.getAuthenticationLevel()).toBe(5);
    });

    it("should return configured level", async () => {
      await auth.init({ SSLAuthnLevel: 10 }, logger);
      expect(auth.getAuthenticationLevel()).toBe(10);
    });
  });

  describe("isAjaxEnabled", () => {
    it("should return false by default", async () => {
      await auth.init({}, logger);
      expect(auth.isAjaxEnabled()).toBe(false);
    });

    it("should return true when configured", async () => {
      await auth.init({ sslByAjax: true }, logger);
      expect(auth.isAjaxEnabled()).toBe(true);
    });
  });

  describe("getAjaxUrl", () => {
    it("should return undefined by default", async () => {
      await auth.init({}, logger);
      expect(auth.getAjaxUrl()).toBeUndefined();
    });

    it("should return configured URL", async () => {
      await auth.init({ sslHost: "https://ssl.example.com/auth" }, logger);
      expect(auth.getAjaxUrl()).toBe("https://ssl.example.com/auth");
    });
  });

  describe("close", () => {
    it("should close without error", async () => {
      await auth.init({}, logger);
      await expect(auth.close()).resolves.toBeUndefined();
    });
  });
});

describe("extractSSLEnv edge cases", () => {
  let auth: SSLAuth;
  let logger: Logger;

  beforeEach(async () => {
    auth = new SSLAuth();
    logger = createLogger();
    await auth.init({}, logger);

    // Clear process.env SSL vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("SSL_CLIENT_") || key.startsWith("SSL_SERVER_")) {
        delete process.env[key];
      }
    }
  });

  it("should handle mixed case headers", async () => {
    const req = {
      headers: {
        "SSL-CLIENT-S-DN-EMAIL": "mixed@example.com",
        "SSL-CLIENT-VERIFY": "SUCCESS",
      },
    } as unknown as Request;

    // Note: Express lowercases all headers, so this tests our handling
    const result = await auth.authenticate(req);
    // This should fail because headers are typically lowercased by Express
    expect(result.success).toBe(false);
  });

  it("should handle empty headers object", async () => {
    const req = { headers: {} } as unknown as Request;

    const result = await auth.authenticate(req);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("PE_CERTIFICATEREQUIRED");
  });

  it("should handle undefined headers", async () => {
    const req = {} as unknown as Request;

    const result = await auth.authenticate(req);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("PE_CERTIFICATEREQUIRED");
  });
});
