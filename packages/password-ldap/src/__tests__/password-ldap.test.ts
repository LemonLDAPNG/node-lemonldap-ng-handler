/**
 * LDAP Password module tests
 */
import {
  createTestLDAPServer,
  TestLDAPServer,
} from "../../../lib-ldap/src/__tests__/test-ldap-server";
import { LDAPConnection } from "@lemonldap-ng/lib-ldap";
import { LDAPPassword, ADPassword } from "../index";
import type { LLNG_Conf, LLNG_Logger } from "@lemonldap-ng/types";

// Increase global timeout for async operations
jest.setTimeout(30000);

describe("LDAPPassword", () => {
  let server: TestLDAPServer;
  let passwordModule: LDAPPassword;
  const testPort = 3895;

  const mockLogger: LLNG_Logger = {
    error: jest.fn(),
    warn: jest.fn(),
    notice: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const testConf = {
    ldapServer: `ldap://127.0.0.1:${testPort}`,
    ldapBase: "dc=example,dc=com",
    managerDn: "cn=admin,dc=example,dc=com",
    managerPassword: "admin",
    AuthLDAPFilter: "(&(uid=$user)(objectClass=inetOrgPerson))",
    ldapPpolicyControl: false,
    portalRequireOldPassword: true,
  } as unknown as LLNG_Conf;

  beforeAll(async () => {
    server = await createTestLDAPServer({ port: testPort });
  });

  afterAll(async () => {
    // Close all shared connections first
    await LDAPConnection.closeAllSharedConnections();
    // Then stop the server
    await server.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset user passwords
    server.setUserPassword("uid=dwho,ou=users,dc=example,dc=com", "dwho");
    server.setUserPassword("uid=rtyler,ou=users,dc=example,dc=com", "rtyler");

    passwordModule = new LDAPPassword();
    await passwordModule.init(testConf, mockLogger);
  });

  afterEach(async () => {
    await passwordModule.close?.();
  });

  describe("init", () => {
    it("should initialize successfully", () => {
      expect(passwordModule.name).toBe("LDAP");
      expect(mockLogger.info).toHaveBeenCalledWith(
        "LDAP Password module initialized",
      );
    });
  });

  describe("confirm", () => {
    it("should return true for correct password", async () => {
      const result = await passwordModule.confirm(
        "uid=dwho,ou=users,dc=example,dc=com",
        "dwho",
      );
      expect(result).toBe(true);
    });

    it("should return false for incorrect password", async () => {
      const result = await passwordModule.confirm(
        "uid=dwho,ou=users,dc=example,dc=com",
        "wrongpassword",
      );
      expect(result).toBe(false);
    });
  });

  describe("modifyPassword", () => {
    it("should change password as manager", async () => {
      const result = await passwordModule.modifyPassword(
        "uid=dwho,ou=users,dc=example,dc=com",
        "newpassword123",
        { passwordReset: true }, // Skip old password requirement
      );

      expect(result.success).toBe(true);

      // Verify new password works
      const confirmResult = await passwordModule.confirm(
        "uid=dwho,ou=users,dc=example,dc=com",
        "newpassword123",
      );
      expect(confirmResult).toBe(true);

      // Verify old password no longer works
      const oldConfirmResult = await passwordModule.confirm(
        "uid=dwho,ou=users,dc=example,dc=com",
        "dwho",
      );
      expect(oldConfirmResult).toBe(false);
    });

    it("should require old password when configured", async () => {
      const result = await passwordModule.modifyPassword(
        "uid=dwho,ou=users,dc=example,dc=com",
        "newpassword123",
        // No oldPassword provided
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("PE_PP_MUST_SUPPLY_OLD_PASSWORD");
    });

    it("should change password with old password verification", async () => {
      const result = await passwordModule.modifyPassword(
        "uid=dwho,ou=users,dc=example,dc=com",
        "newpassword123",
        { oldPassword: "dwho" },
      );

      expect(result.success).toBe(true);

      // Verify new password works
      const confirmResult = await passwordModule.confirm(
        "uid=dwho,ou=users,dc=example,dc=com",
        "newpassword123",
      );
      expect(confirmResult).toBe(true);
    });

    it("should fail with wrong old password", async () => {
      const result = await passwordModule.modifyPassword(
        "uid=dwho,ou=users,dc=example,dc=com",
        "newpassword123",
        { oldPassword: "wrongpassword" },
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("PE_BADOLDPASSWORD");
    });

    it("should work without old password when passwordReset is true", async () => {
      const result = await passwordModule.modifyPassword(
        "uid=rtyler,ou=users,dc=example,dc=com",
        "newpassword456",
        { passwordReset: true },
      );

      expect(result.success).toBe(true);

      // Verify new password works
      const confirmResult = await passwordModule.confirm(
        "uid=rtyler,ou=users,dc=example,dc=com",
        "newpassword456",
      );
      expect(confirmResult).toBe(true);
    });
  });
});

describe("ADPassword", () => {
  it("should have correct name", () => {
    const adPasswordModule = new ADPassword();
    expect(adPasswordModule.name).toBe("AD");
  });

  // Note: Full AD tests would require an Active Directory mock or real server
  // The ADPassword class uses unicodePwd with UTF-16LE encoding which
  // is specific to Microsoft Active Directory
});
