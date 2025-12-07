/**
 * PostgreSQL Integration tests for DBI Authentication module
 * These tests only run in CI environment where PostgreSQL is available
 */

import { DBIAuth } from "../index";
import type { LLNG_Conf, LLNG_Logger } from "@lemonldap-ng/types";

// Skip tests if PostgreSQL is not available
const hasPostgres = Boolean(
  process.env.POSTGRES_TEST_HOST &&
  process.env.POSTGRES_TEST_USER &&
  process.env.POSTGRES_TEST_PASSWORD &&
  process.env.POSTGRES_TEST_DATABASE,
);

const describeIf = hasPostgres ? describe : describe.skip;

describeIf("DBIAuth PostgreSQL Integration", () => {
  let authModule: DBIAuth;

  const mockLogger: LLNG_Logger = {
    error: jest.fn(),
    warn: jest.fn(),
    notice: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const pgConfig = {
    dbiAuthChain: `dbi:Pg:dbname=${process.env.POSTGRES_TEST_DATABASE};host=${process.env.POSTGRES_TEST_HOST};port=${process.env.POSTGRES_TEST_PORT || "5432"}`,
    dbiAuthUser: process.env.POSTGRES_TEST_USER,
    dbiAuthPassword: process.env.POSTGRES_TEST_PASSWORD,
    dbiAuthTable: "users",
    dbiAuthLoginCol: "user_id",
    dbiAuthPasswordCol: "password",
  } as unknown as LLNG_Conf;

  beforeEach(() => {
    jest.clearAllMocks();
    authModule = new DBIAuth();
  });

  afterEach(async () => {
    await authModule.close?.();
  });

  it("should initialize with PostgreSQL", async () => {
    await authModule.init(pgConfig, mockLogger);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("DBI auth initialized"),
    );
  });

  it("should authenticate valid user", async () => {
    await authModule.init(pgConfig, mockLogger);

    const result = await authModule.authenticate({
      user: "dwho",
      password: "dwho",
    });

    expect(result.success).toBe(true);
  });

  it("should reject wrong password", async () => {
    await authModule.init(pgConfig, mockLogger);

    const result = await authModule.authenticate({
      user: "dwho",
      password: "wrongpassword",
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("PE_BADCREDENTIALS");
  });

  it("should handle UTF-8 data from PostgreSQL", async () => {
    await authModule.init(pgConfig, mockLogger);

    const result = await authModule.authenticate({
      user: "french",
      password: "french",
    });

    expect(result.success).toBe(true);

    const entry = authModule.getLastEntry();
    expect(entry?.name).toBe("Frédéric Accents");
  });

  it("should handle Cyrillic data from PostgreSQL", async () => {
    await authModule.init(pgConfig, mockLogger);

    const result = await authModule.authenticate({
      user: "russian",
      password: "russian",
    });

    expect(result.success).toBe(true);

    const entry = authModule.getLastEntry();
    expect(entry?.name).toBe("Русский Пользователь");
  });
});
