import { DemoUserDB, createUserDBModule } from "../index";
import type { LLNG_Conf, LLNG_Logger, LLNG_Session } from "@lemonldap-ng/types";

const mockLogger: LLNG_Logger = {
  error: jest.fn(),
  warn: jest.fn(),
  notice: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

describe("DemoUserDB", () => {
  let userDB: DemoUserDB;

  beforeEach(async () => {
    userDB = new DemoUserDB();
    await userDB.init({} as LLNG_Conf, mockLogger);
  });

  afterEach(async () => {
    await userDB.close();
    jest.clearAllMocks();
  });

  describe("factory function", () => {
    it("should create an instance", () => {
      const instance = createUserDBModule();
      expect(instance).toBeInstanceOf(DemoUserDB);
    });
  });

  describe("init", () => {
    it("should initialize with default users", async () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("2 users"),
      );
    });

    it("should initialize with custom users from config", async () => {
      const customDB = new DemoUserDB();
      const conf = {
        demoExportedVars: {
          alice: { uid: "alice", cn: "Alice", mail: "alice@example.com" },
          bob: { uid: "bob", cn: "Bob", mail: "bob@example.com" },
        },
        exportedVars: {
          uid: "uid",
          cn: "cn",
          mail: "mail",
        },
      } as unknown as LLNG_Conf;

      await customDB.init(conf, mockLogger);

      const user = await customDB.getUser("alice");
      expect(user?.uid).toBe("alice");
      expect(user?.attributes.cn).toBe("Alice");

      await customDB.close();
    });
  });

  describe("getUser", () => {
    it("should get default user dwho", async () => {
      const user = await userDB.getUser("dwho");
      expect(user).not.toBeNull();
      expect(user?.uid).toBe("dwho");
      expect(user?.attributes.cn).toBe("Doctor Who");
      expect(user?.attributes.mail).toBe("dwho@example.com");
    });

    it("should get default user rtyler", async () => {
      const user = await userDB.getUser("rtyler");
      expect(user).not.toBeNull();
      expect(user?.uid).toBe("rtyler");
      expect(user?.attributes.cn).toBe("Rose Tyler");
    });

    it("should return null for unknown user", async () => {
      const user = await userDB.getUser("unknown");
      expect(user).toBeNull();
    });
  });

  describe("setSessionInfo", () => {
    it("should set session info from user data", async () => {
      const session: LLNG_Session = {
        _session_id: "test123",
        _utime: Date.now() / 1000,
      };

      const user = await userDB.getUser("dwho");
      expect(user).not.toBeNull();

      userDB.setSessionInfo(session, user!);

      expect(session.uid).toBe("dwho");
      expect((session as any).cn).toBe("Doctor Who");
      expect((session as any).mail).toBe("dwho@example.com");
    });

    it("should set groups if present", async () => {
      const customDB = new DemoUserDB();
      const conf = {
        demoExportedVars: {
          admin: {
            uid: "admin",
            cn: "Admin User",
            groups: "admins,users",
          },
        },
        exportedVars: { uid: "uid", cn: "cn" },
      } as unknown as LLNG_Conf;

      await customDB.init(conf, mockLogger);

      const session: LLNG_Session = {
        _session_id: "test",
        _utime: Date.now() / 1000,
      };

      const user = await customDB.getUser("admin");
      customDB.setSessionInfo(session, user!);

      expect(session.groups).toBe("admins; users");
      await customDB.close();
    });
  });
});
