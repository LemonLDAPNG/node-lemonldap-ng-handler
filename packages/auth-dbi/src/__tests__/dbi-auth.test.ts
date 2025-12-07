/**
 * DBI Authentication module tests
 */
import { DBIAuth, createDBIAuth } from "../index";
import type { LLNG_Conf, LLNG_Logger } from "@lemonldap-ng/types";
import PerlDBI from "perl-dbi";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import crypto from "crypto";

describe("DBIAuth", () => {
  let authModule: DBIAuth;
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
    dbPath = path.join(os.tmpdir(), `llng-test-${Date.now()}.db`);

    db = PerlDBI({
      dbiChain: `dbi:SQLite:dbname=${dbPath}`,
    });

    // Create users table
    await db.schema.createTable("users", (table) => {
      table.string("user").primary();
      table.string("password");
      table.string("name");
      table.string("mail");
    });

    // Insert test users
    await db("users").insert([
      {
        user: "dwho",
        password: "dwho",
        name: "Doctor Who",
        mail: "dwho@example.com",
      },
      {
        user: "rtyler",
        password: "rtyler",
        name: "Rose Tyler",
        mail: "rtyler@example.com",
      },
      // User with SHA256 hashed password
      {
        user: "hashed",
        password: crypto.createHash("sha256").update("secret").digest("hex"),
        name: "Hashed User",
        mail: "hashed@example.com",
      },
      // User with dynamic hash format {SHA256}base64
      {
        user: "dynamic",
        password: `{SHA256}${crypto.createHash("sha256").update("dynamic123").digest("base64")}`,
        name: "Dynamic Hash User",
        mail: "dynamic@example.com",
      },
      // UTF-8 user
      {
        user: "french",
        password: "french",
        name: "Frédéric Accents",
        mail: "french@example.com",
      },
      {
        user: "russian",
        password: "russian",
        name: "Русский",
        mail: "russian@example.com",
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
    authModule = new DBIAuth();
  });

  afterEach(async () => {
    await authModule.close?.();
  });

  describe("factory function", () => {
    it("should create an instance", () => {
      const instance = createDBIAuth();
      expect(instance).toBeInstanceOf(DBIAuth);
    });
  });

  describe("init", () => {
    it("should initialize and connect to database", async () => {
      const conf = {
        dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiAuthTable: "users",
        dbiAuthLoginCol: "user",
        dbiAuthPasswordCol: "password",
      } as unknown as LLNG_Conf;

      await authModule.init(conf, mockLogger);

      expect(authModule.name).toBe("DBI");
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("DBI auth initialized"),
      );
    });

    it("should throw error on missing dbiAuthChain", async () => {
      const conf = {
        dbiAuthTable: "users",
        dbiAuthLoginCol: "user",
        dbiAuthPasswordCol: "password",
      } as unknown as LLNG_Conf;

      await expect(authModule.init(conf, mockLogger)).rejects.toThrow(
        "dbiAuthChain is required",
      );
    });

    it("should throw error on missing dbiAuthTable", async () => {
      const conf = {
        dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiAuthLoginCol: "user",
        dbiAuthPasswordCol: "password",
      } as unknown as LLNG_Conf;

      await expect(authModule.init(conf, mockLogger)).rejects.toThrow(
        "dbiAuthTable is required",
      );
    });
  });

  describe("extractCredentials", () => {
    beforeEach(async () => {
      const conf = {
        dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiAuthTable: "users",
        dbiAuthLoginCol: "user",
        dbiAuthPasswordCol: "password",
      } as unknown as LLNG_Conf;
      await authModule.init(conf, mockLogger);
    });

    it("should extract user and password from body", () => {
      const req = { body: { user: "dwho", password: "dwho" } } as any;
      const creds = authModule.extractCredentials(req);
      expect(creds).toEqual({ user: "dwho", password: "dwho" });
    });

    it("should handle alternative field names", () => {
      const req = { body: { username: "dwho", pwd: "dwho" } } as any;
      const creds = authModule.extractCredentials(req);
      expect(creds).toEqual({ user: "dwho", password: "dwho" });
    });

    it("should return null for missing credentials", () => {
      const req = { body: {} } as any;
      const creds = authModule.extractCredentials(req);
      expect(creds).toBeNull();
    });
  });

  describe("authenticate", () => {
    describe("with plaintext passwords", () => {
      beforeEach(async () => {
        const conf = {
          dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
          dbiAuthTable: "users",
          dbiAuthLoginCol: "user",
          dbiAuthPasswordCol: "password",
          dbiAuthPasswordHash: "",
        } as unknown as LLNG_Conf;
        await authModule.init(conf, mockLogger);
      });

      it("should authenticate valid user", async () => {
        const result = await authModule.authenticate({
          user: "dwho",
          password: "dwho",
        });
        expect(result.success).toBe(true);
      });

      it("should reject unknown user", async () => {
        const result = await authModule.authenticate({
          user: "unknown",
          password: "password",
        });
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe("PE_BADCREDENTIALS");
      });

      it("should reject wrong password", async () => {
        const result = await authModule.authenticate({
          user: "dwho",
          password: "wrongpassword",
        });
        expect(result.success).toBe(false);
        expect(result.errorCode).toBe("PE_BADCREDENTIALS");
      });
    });

    describe("with SHA256 hashed passwords", () => {
      beforeEach(async () => {
        const conf = {
          dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
          dbiAuthTable: "users",
          dbiAuthLoginCol: "user",
          dbiAuthPasswordCol: "password",
          dbiAuthPasswordHash: "sha256",
        } as unknown as LLNG_Conf;
        await authModule.init(conf, mockLogger);
      });

      it("should authenticate with hashed password", async () => {
        const result = await authModule.authenticate({
          user: "hashed",
          password: "secret",
        });
        expect(result.success).toBe(true);
      });

      it("should reject wrong password for hashed user", async () => {
        const result = await authModule.authenticate({
          user: "hashed",
          password: "wrongpassword",
        });
        expect(result.success).toBe(false);
      });
    });

    describe("with dynamic hash", () => {
      beforeEach(async () => {
        const conf = {
          dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
          dbiAuthTable: "users",
          dbiAuthLoginCol: "user",
          dbiAuthPasswordCol: "password",
          dbiDynamicHashEnabled: true,
        } as unknown as LLNG_Conf;
        await authModule.init(conf, mockLogger);
      });

      it("should authenticate with dynamic hash format", async () => {
        const result = await authModule.authenticate({
          user: "dynamic",
          password: "dynamic123",
        });
        expect(result.success).toBe(true);
      });

      it("should reject wrong password for dynamic hash user", async () => {
        const result = await authModule.authenticate({
          user: "dynamic",
          password: "wrongpassword",
        });
        expect(result.success).toBe(false);
      });
    });

    describe("UTF-8 support", () => {
      beforeEach(async () => {
        const conf = {
          dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
          dbiAuthTable: "users",
          dbiAuthLoginCol: "user",
          dbiAuthPasswordCol: "password",
        } as unknown as LLNG_Conf;
        await authModule.init(conf, mockLogger);
      });

      it("should authenticate user with French accents", async () => {
        const result = await authModule.authenticate({
          user: "french",
          password: "french",
        });
        expect(result.success).toBe(true);

        const entry = authModule.getLastEntry();
        expect(entry?.name).toBe("Frédéric Accents");
      });

      it("should authenticate user with Cyrillic characters", async () => {
        const result = await authModule.authenticate({
          user: "russian",
          password: "russian",
        });
        expect(result.success).toBe(true);

        const entry = authModule.getLastEntry();
        expect(entry?.name).toBe("Русский");
      });
    });
  });

  describe("getLastEntry", () => {
    beforeEach(async () => {
      const conf = {
        dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiAuthTable: "users",
        dbiAuthLoginCol: "user",
        dbiAuthPasswordCol: "password",
      } as unknown as LLNG_Conf;
      await authModule.init(conf, mockLogger);
    });

    it("should return null before authentication", () => {
      expect(authModule.getLastEntry()).toBeNull();
    });

    it("should return entry after successful authentication", async () => {
      await authModule.authenticate({ user: "dwho", password: "dwho" });
      const entry = authModule.getLastEntry();
      expect(entry).not.toBeNull();
      expect(entry?.user).toBe("dwho");
      expect(entry?.name).toBe("Doctor Who");
      expect(entry?.mail).toBe("dwho@example.com");
    });

    it("should return null after failed authentication", async () => {
      await authModule.authenticate({ user: "dwho", password: "wrong" });
      expect(authModule.getLastEntry()).toBeNull();
    });
  });

  describe("close", () => {
    it("should close database connection", async () => {
      const conf = {
        dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiAuthTable: "users",
        dbiAuthLoginCol: "user",
        dbiAuthPasswordCol: "password",
      } as unknown as LLNG_Conf;
      await authModule.init(conf, mockLogger);
      await authModule.close();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "DBI auth connection closed",
      );
    });
  });
});
