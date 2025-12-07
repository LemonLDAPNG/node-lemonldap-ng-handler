/**
 * DBI UserDB module tests
 */
import { DBIUserDB, createDBIUserDB, createUserDBModule } from "../index";
import type { LLNG_Conf, LLNG_Logger, LLNG_Session } from "@lemonldap-ng/types";
import PerlDBI from "perl-dbi";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("DBIUserDB", () => {
  let userdbModule: DBIUserDB;
  let dbPath: string;
  let db: ReturnType<typeof PerlDBI>;

  const mockLogger: LLNG_Logger = {
    error: jest.fn(),
    warn: jest.fn(),
    notice: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  beforeAll(async () => {
    // Create temp database
    dbPath = path.join(os.tmpdir(), `llng-userdb-test-${Date.now()}.db`);

    db = PerlDBI({
      dbiChain: `dbi:SQLite:dbname=${dbPath}`,
    });

    // Create users table with various attributes
    await db.schema.createTable("users", (table) => {
      table.string("user").primary();
      table.string("password");
      table.string("name");
      table.string("mail");
      table.string("department");
      table.string("phone");
      table.integer("age");
    });

    // Insert test users
    await db("users").insert([
      {
        user: "dwho",
        password: "dwho",
        name: "Doctor Who",
        mail: "dwho@example.com",
        department: "Time Lords",
        phone: "+44123456",
        age: 900,
      },
      {
        user: "rtyler",
        password: "rtyler",
        name: "Rose Tyler",
        mail: "rtyler@example.com",
        department: "Companions",
        phone: "+44987654",
        age: 25,
      },
      // UTF-8 user
      {
        user: "french",
        password: "french",
        name: "Frédéric Accents",
        mail: "french@example.com",
        department: "Département Français",
        phone: "+33123456",
        age: 42,
      },
      {
        user: "russian",
        password: "russian",
        name: "Русский Пользователь",
        mail: "russian@example.com",
        department: "Отдел",
        phone: "+7123456",
        age: 35,
      },
    ]);
  });

  afterAll(async () => {
    await db.destroy();
    // Clean up temp database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    userdbModule = new DBIUserDB();
  });

  afterEach(async () => {
    await userdbModule.close?.();
  });

  describe("factory functions", () => {
    it("should create an instance with createDBIUserDB", () => {
      const instance = createDBIUserDB();
      expect(instance).toBeInstanceOf(DBIUserDB);
    });

    it("should create an instance with createUserDBModule", () => {
      const instance = createUserDBModule();
      expect(instance).toBeInstanceOf(DBIUserDB);
    });
  });

  describe("init", () => {
    it("should initialize and connect to database", async () => {
      const conf = {
        dbiUserChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiUserTable: "users",
        dbiUserLoginCol: "user",
      } as unknown as LLNG_Conf;

      await userdbModule.init(conf, mockLogger);

      expect(userdbModule.name).toBe("DBI");
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("DBI UserDB initialized"),
      );
    });

    it("should fall back to auth config when userdb not specified", async () => {
      const conf = {
        dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiAuthTable: "users",
        dbiAuthLoginCol: "user",
      } as unknown as LLNG_Conf;

      await userdbModule.init(conf, mockLogger);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it("should throw error on missing dbiUserChain", async () => {
      const conf = {
        dbiUserTable: "users",
        dbiUserLoginCol: "user",
      } as unknown as LLNG_Conf;

      await expect(userdbModule.init(conf, mockLogger)).rejects.toThrow(
        "dbiUserChain is required",
      );
    });

    it("should throw error on missing dbiUserTable", async () => {
      const conf = {
        dbiUserChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiUserLoginCol: "user",
      } as unknown as LLNG_Conf;

      await expect(userdbModule.init(conf, mockLogger)).rejects.toThrow(
        "dbiUserTable is required",
      );
    });
  });

  describe("getUser", () => {
    beforeEach(async () => {
      const conf = {
        dbiUserChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiUserTable: "users",
        dbiUserLoginCol: "user",
        dbiExportedVars: {
          uid: "user",
          cn: "name",
          mail: "mail",
          dept: "department",
        },
      } as unknown as LLNG_Conf;
      await userdbModule.init(conf, mockLogger);
    });

    it("should get user data", async () => {
      const userData = await userdbModule.getUser("dwho");

      expect(userData).not.toBeNull();
      expect(userData?.uid).toBe("dwho");
      expect(userData?.attributes.cn).toBe("Doctor Who");
      expect(userData?.attributes.mail).toBe("dwho@example.com");
      expect(userData?.attributes.dept).toBe("Time Lords");
    });

    it("should return null for unknown user", async () => {
      const userData = await userdbModule.getUser("unknown");
      expect(userData).toBeNull();
    });

    it("should handle UTF-8 names", async () => {
      const userData = await userdbModule.getUser("french");

      expect(userData).not.toBeNull();
      expect(userData?.attributes.cn).toBe("Frédéric Accents");
      expect(userData?.attributes.dept).toBe("Département Français");
    });

    it("should handle Cyrillic characters", async () => {
      const userData = await userdbModule.getUser("russian");

      expect(userData).not.toBeNull();
      expect(userData?.attributes.cn).toBe("Русский Пользователь");
      expect(userData?.attributes.dept).toBe("Отдел");
    });
  });

  describe("getUserByMail", () => {
    beforeEach(async () => {
      const conf = {
        dbiUserChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiUserTable: "users",
        dbiUserLoginCol: "user",
        dbiUserMailCol: "mail",
        dbiExportedVars: {
          uid: "user",
          cn: "name",
          mail: "mail",
        },
      } as unknown as LLNG_Conf;
      await userdbModule.init(conf, mockLogger);
    });

    it("should get user by email", async () => {
      const userData = await userdbModule.getUserByMail("dwho@example.com");

      expect(userData).not.toBeNull();
      expect(userData?.uid).toBe("dwho");
      expect(userData?.attributes.cn).toBe("Doctor Who");
    });

    it("should return null for unknown email", async () => {
      const userData = await userdbModule.getUserByMail("unknown@example.com");
      expect(userData).toBeNull();
    });
  });

  describe("setSessionInfo", () => {
    beforeEach(async () => {
      const conf = {
        dbiUserChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiUserTable: "users",
        dbiUserLoginCol: "user",
        dbiExportedVars: {
          uid: "user",
          cn: "name",
          mail: "mail",
          department: "department",
        },
      } as unknown as LLNG_Conf;
      await userdbModule.init(conf, mockLogger);
    });

    it("should set session info from user data", async () => {
      const userData = await userdbModule.getUser("dwho");
      expect(userData).not.toBeNull();

      const session: LLNG_Session = {
        _session_id: "test-session",
        _utime: Date.now(),
        _session_kind: "SSO",
        uid: "",
      };

      userdbModule.setSessionInfo(session, userData!);

      expect(session.uid).toBe("dwho");
      expect(session._user).toBe("dwho");
      expect((session as any).cn).toBe("Doctor Who");
      expect((session as any).mail).toBe("dwho@example.com");
      expect((session as any).department).toBe("Time Lords");
    });

    it("should preserve existing _user if set", async () => {
      const userData = await userdbModule.getUser("dwho");

      const session: LLNG_Session = {
        _session_id: "test-session",
        _utime: Date.now(),
        _session_kind: "SSO",
        uid: "",
        _user: "existing_user",
      };

      userdbModule.setSessionInfo(session, userData!);

      expect(session.uid).toBe("dwho");
      expect(session._user).toBe("existing_user");
    });

    it("should not copy internal _dbi_ attributes", async () => {
      const userData = await userdbModule.getUser("dwho");

      const session: LLNG_Session = {
        _session_id: "test-session",
        _utime: Date.now(),
        _session_kind: "SSO",
        uid: "",
      };

      userdbModule.setSessionInfo(session, userData!);

      // _dbi_ attributes should not be in session
      expect((session as any)._dbi_user).toBeUndefined();
      expect((session as any)._dbi_password).toBeUndefined();
    });
  });

  describe("default exportedVars", () => {
    it("should use default mapping when exportedVars not specified", async () => {
      const conf = {
        dbiUserChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiUserTable: "users",
        dbiUserLoginCol: "user",
        dbiUserMailCol: "mail",
      } as unknown as LLNG_Conf;
      await userdbModule.init(conf, mockLogger);

      const userData = await userdbModule.getUser("dwho");

      expect(userData).not.toBeNull();
      expect(userData?.attributes.uid).toBe("dwho");
      expect(userData?.attributes.mail).toBe("dwho@example.com");
    });
  });

  describe("close", () => {
    it("should close database connection", async () => {
      const conf = {
        dbiUserChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiUserTable: "users",
        dbiUserLoginCol: "user",
      } as unknown as LLNG_Conf;
      await userdbModule.init(conf, mockLogger);
      await userdbModule.close();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "DBI UserDB connection closed",
      );
    });
  });
});
