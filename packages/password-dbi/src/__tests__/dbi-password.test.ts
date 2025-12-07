/**
 * DBI Password module tests
 */
import { DBIPassword, createDBIPassword, createPasswordModule } from "../index";
import type { LLNG_Conf, LLNG_Logger } from "@lemonldap-ng/types";
import PerlDBI from "perl-dbi";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import crypto from "crypto";

describe("DBIPassword", () => {
  let passwordModule: DBIPassword;
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
    dbPath = path.join(os.tmpdir(), `llng-password-test-${Date.now()}.db`);

    db = PerlDBI({
      dbiChain: `dbi:SQLite:dbname=${dbPath}`,
    });

    // Create users table
    await db.schema.createTable("users", (table) => {
      table.string("user").primary();
      table.string("password");
      table.string("mail");
    });

    // Insert test users with different password formats
    await db("users").insert([
      // Plaintext password
      { user: "plain", password: "secret123", mail: "plain@example.com" },
      // SHA256 hex hash
      {
        user: "sha256hex",
        password: crypto.createHash("sha256").update("hashed123").digest("hex"),
        mail: "sha256@example.com",
      },
      // Dynamic hash format {SHA256}base64
      {
        user: "dynamic",
        password: `{SHA256}${crypto.createHash("sha256").update("dynamic123").digest("base64")}`,
        mail: "dynamic@example.com",
      },
      // Salted hash format {SSHA256}base64(hash+salt)
      {
        user: "salted",
        password: (() => {
          const salt = Buffer.from("12345678");
          const hash = crypto
            .createHash("sha256")
            .update("salted123")
            .update(salt)
            .digest();
          return `{SSHA256}${Buffer.concat([hash, salt]).toString("base64")}`;
        })(),
        mail: "salted@example.com",
      },
    ]);
  });

  afterAll(async () => {
    await db.destroy();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    passwordModule = new DBIPassword();
  });

  afterEach(async () => {
    await passwordModule.close?.();
  });

  describe("factory functions", () => {
    it("should create an instance with createDBIPassword", () => {
      const instance = createDBIPassword();
      expect(instance).toBeInstanceOf(DBIPassword);
    });

    it("should create an instance with createPasswordModule", () => {
      const instance = createPasswordModule();
      expect(instance).toBeInstanceOf(DBIPassword);
    });
  });

  describe("init", () => {
    it("should initialize successfully", async () => {
      const conf = {
        dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
        dbiAuthTable: "users",
        dbiAuthLoginCol: "user",
        dbiAuthPasswordCol: "password",
      } as unknown as LLNG_Conf;

      await passwordModule.init(conf, mockLogger);

      expect(passwordModule.name).toBe("DBI");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "DBI Password module initialized",
      );
    });

    it("should throw error on missing dbiAuthChain", async () => {
      const conf = {
        dbiAuthTable: "users",
        dbiAuthLoginCol: "user",
        dbiAuthPasswordCol: "password",
      } as unknown as LLNG_Conf;

      await expect(passwordModule.init(conf, mockLogger)).rejects.toThrow(
        "dbiAuthChain is required",
      );
    });
  });

  describe("confirm", () => {
    describe("with plaintext passwords", () => {
      beforeEach(async () => {
        const conf = {
          dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
          dbiAuthTable: "users",
          dbiAuthLoginCol: "user",
          dbiAuthPasswordCol: "password",
        } as unknown as LLNG_Conf;
        await passwordModule.init(conf, mockLogger);
      });

      it("should confirm correct password", async () => {
        const result = await passwordModule.confirm("plain", "secret123");
        expect(result).toBe(true);
      });

      it("should reject wrong password", async () => {
        const result = await passwordModule.confirm("plain", "wrongpassword");
        expect(result).toBe(false);
      });

      it("should return false for unknown user", async () => {
        const result = await passwordModule.confirm("unknown", "password");
        expect(result).toBe(false);
      });
    });

    describe("with SHA256 hex passwords", () => {
      beforeEach(async () => {
        const conf = {
          dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
          dbiAuthTable: "users",
          dbiAuthLoginCol: "user",
          dbiAuthPasswordCol: "password",
          dbiAuthPasswordHash: "sha256",
        } as unknown as LLNG_Conf;
        await passwordModule.init(conf, mockLogger);
      });

      it("should confirm correct hashed password", async () => {
        const result = await passwordModule.confirm("sha256hex", "hashed123");
        expect(result).toBe(true);
      });

      it("should reject wrong password", async () => {
        const result = await passwordModule.confirm("sha256hex", "wrong");
        expect(result).toBe(false);
      });
    });

    describe("with dynamic hash passwords", () => {
      beforeEach(async () => {
        const conf = {
          dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
          dbiAuthTable: "users",
          dbiAuthLoginCol: "user",
          dbiAuthPasswordCol: "password",
          dbiDynamicHashEnabled: true,
        } as unknown as LLNG_Conf;
        await passwordModule.init(conf, mockLogger);
      });

      it("should confirm dynamic hash password", async () => {
        const result = await passwordModule.confirm("dynamic", "dynamic123");
        expect(result).toBe(true);
      });

      it("should confirm salted hash password", async () => {
        const result = await passwordModule.confirm("salted", "salted123");
        expect(result).toBe(true);
      });
    });
  });

  describe("modifyPassword", () => {
    describe("with plaintext storage", () => {
      beforeEach(async () => {
        const conf = {
          dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
          dbiAuthTable: "users",
          dbiAuthLoginCol: "user",
          dbiAuthPasswordCol: "password",
        } as unknown as LLNG_Conf;
        await passwordModule.init(conf, mockLogger);
      });

      it("should change password successfully", async () => {
        const result = await passwordModule.modifyPassword(
          "plain",
          "newpassword123",
        );

        expect(result.success).toBe(true);
        expect(result.message).toBe("Password changed successfully");

        // Verify new password works
        const confirmed = await passwordModule.confirm(
          "plain",
          "newpassword123",
        );
        expect(confirmed).toBe(true);
      });

      it("should return error for unknown user", async () => {
        const result = await passwordModule.modifyPassword(
          "nonexistent",
          "newpassword",
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe("PE_USERNOTFOUND");
      });
    });

    describe("with old password requirement", () => {
      beforeEach(async () => {
        const conf = {
          dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
          dbiAuthTable: "users",
          dbiAuthLoginCol: "user",
          dbiAuthPasswordCol: "password",
          portalRequireOldPassword: true,
        } as unknown as LLNG_Conf;
        await passwordModule.init(conf, mockLogger);
      });

      it("should require old password when configured", async () => {
        const result = await passwordModule.modifyPassword(
          "plain",
          "newpassword",
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe("PE_PP_MUST_SUPPLY_OLD_PASSWORD");
      });

      it("should accept correct old password", async () => {
        // First reset password to known value
        await db("users").where("user", "plain").update({ password: "oldpwd" });

        const result = await passwordModule.modifyPassword(
          "plain",
          "newpassword",
          { oldPassword: "oldpwd" },
        );

        expect(result.success).toBe(true);
      });

      it("should reject wrong old password", async () => {
        const result = await passwordModule.modifyPassword(
          "plain",
          "newpassword",
          { oldPassword: "wrongoldpwd" },
        );

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe("PE_BADOLDPASSWORD");
      });

      it("should skip old password check on reset", async () => {
        const result = await passwordModule.modifyPassword(
          "plain",
          "resetpassword",
          { passwordReset: true },
        );

        expect(result.success).toBe(true);
      });
    });

    describe("with dynamic hash storage", () => {
      beforeEach(async () => {
        const conf = {
          dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
          dbiAuthTable: "users",
          dbiAuthLoginCol: "user",
          dbiAuthPasswordCol: "password",
          dbiDynamicHashEnabled: true,
          dbiDynamicHashNewPasswordScheme: "SHA256",
        } as unknown as LLNG_Conf;
        await passwordModule.init(conf, mockLogger);
      });

      it("should store password with dynamic hash format", async () => {
        const result = await passwordModule.modifyPassword(
          "dynamic",
          "newdynamicpwd",
        );

        expect(result.success).toBe(true);

        // Verify password stored with hash format
        const rows = await db("users")
          .where("user", "dynamic")
          .select("password");
        expect(rows[0].password).toMatch(/^\{SHA256\}/);

        // Verify new password works
        const confirmed = await passwordModule.confirm(
          "dynamic",
          "newdynamicpwd",
        );
        expect(confirmed).toBe(true);
      });
    });

    describe("with salted hash storage", () => {
      beforeEach(async () => {
        const conf = {
          dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
          dbiAuthTable: "users",
          dbiAuthLoginCol: "user",
          dbiAuthPasswordCol: "password",
          dbiDynamicHashEnabled: true,
          dbiDynamicHashNewPasswordScheme: "SSHA256",
        } as unknown as LLNG_Conf;
        await passwordModule.init(conf, mockLogger);
      });

      it("should store password with salted hash format", async () => {
        const result = await passwordModule.modifyPassword(
          "salted",
          "newsaltedpwd",
        );

        expect(result.success).toBe(true);

        // Verify password stored with salted hash format
        const rows = await db("users")
          .where("user", "salted")
          .select("password");
        expect(rows[0].password).toMatch(/^\{SSHA256\}/);

        // Verify new password works
        const confirmed = await passwordModule.confirm(
          "salted",
          "newsaltedpwd",
        );
        expect(confirmed).toBe(true);
      });
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
      await passwordModule.init(conf, mockLogger);
      await passwordModule.close();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "DBI Password connection closed",
      );
    });
  });
});
