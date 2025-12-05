import { DemoAuth, createAuthModule } from "../index";
import type { LLNG_Conf, LLNG_Logger } from "@lemonldap-ng/types";

const mockLogger: LLNG_Logger = {
  error: jest.fn(),
  warn: jest.fn(),
  notice: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

describe("DemoAuth", () => {
  let auth: DemoAuth;

  beforeEach(async () => {
    auth = new DemoAuth();
    await auth.init({} as LLNG_Conf, mockLogger);
  });

  afterEach(async () => {
    await auth.close();
    jest.clearAllMocks();
  });

  describe("factory function", () => {
    it("should create an instance", () => {
      const instance = createAuthModule();
      expect(instance).toBeInstanceOf(DemoAuth);
    });
  });

  describe("init", () => {
    it("should initialize with default users", async () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("2 users"),
      );
    });

    it("should initialize with custom users from config", async () => {
      const customAuth = new DemoAuth();
      const conf = {
        demoExportedVars: {
          alice: { _password: "secret", uid: "alice", cn: "Alice" },
          bob: { _password: "pass", uid: "bob", cn: "Bob" },
          charlie: { _password: "123", uid: "charlie", cn: "Charlie" },
        },
      } as unknown as LLNG_Conf;

      await customAuth.init(conf, mockLogger);

      const result = await customAuth.authenticate({
        user: "alice",
        password: "secret",
      });
      expect(result.success).toBe(true);

      await customAuth.close();
    });
  });

  describe("extractCredentials", () => {
    it("should extract user and password from body", () => {
      const req = {
        body: { user: "testuser", password: "testpass" },
      } as any;

      const creds = auth.extractCredentials(req);
      expect(creds).toEqual({ user: "testuser", password: "testpass" });
    });

    it("should handle alternative field names", () => {
      const req = {
        body: { username: "testuser", pwd: "testpass" },
      } as any;

      const creds = auth.extractCredentials(req);
      expect(creds).toEqual({ user: "testuser", password: "testpass" });
    });

    it("should return null for missing credentials", () => {
      const req = { body: {} } as any;
      expect(auth.extractCredentials(req)).toBeNull();
    });

    it("should return null for missing password", () => {
      const req = { body: { user: "testuser" } } as any;
      expect(auth.extractCredentials(req)).toBeNull();
    });
  });

  describe("authenticate", () => {
    it("should authenticate default user dwho", async () => {
      const result = await auth.authenticate({
        user: "dwho",
        password: "dwho",
      });
      expect(result).toEqual({
        success: true,
        user: "dwho",
      });
    });

    it("should authenticate default user rtyler", async () => {
      const result = await auth.authenticate({
        user: "rtyler",
        password: "rtyler",
      });
      expect(result.success).toBe(true);
    });

    it("should reject unknown user", async () => {
      const result = await auth.authenticate({
        user: "unknown",
        password: "whatever",
      });
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("PE_BADCREDENTIALS");
    });

    it("should reject wrong password", async () => {
      const result = await auth.authenticate({
        user: "dwho",
        password: "wrongpassword",
      });
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("PE_BADCREDENTIALS");
    });
  });
});
