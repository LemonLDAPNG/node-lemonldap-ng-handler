import { LDAPConnection } from "../ldap-connection";
import { createTestLDAPServer, TestLDAPServer } from "./test-ldap-server";
import type { LLNG_Logger } from "@lemonldap-ng/types";

describe("LDAPConnection", () => {
  let server: TestLDAPServer;
  let connection: LDAPConnection;

  const mockLogger: LLNG_Logger = {
    error: jest.fn(),
    warn: jest.fn(),
    notice: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  beforeAll(async () => {
    server = await createTestLDAPServer({ port: 3891 });
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (connection) {
      await connection.close();
    }
  });

  describe("connect", () => {
    it("should connect to LDAP server", async () => {
      connection = new LDAPConnection(
        {
          ldapServer: server.url,
          ldapBase: server.baseDN,
          managerDn: server.adminDN,
          managerPassword: server.adminPassword,
        },
        mockLogger,
      );

      await connection.connect();
      expect(connection.isConnected()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Connected to LDAP server"),
      );
    });

    it("should throw on invalid server", async () => {
      connection = new LDAPConnection(
        {
          ldapServer: "ldap://invalid.host:9999",
          ldapBase: "dc=example,dc=com",
          ldapTimeout: 1000,
        },
        mockLogger,
      );

      await expect(connection.connect()).rejects.toThrow();
    });

    it("should try multiple servers", async () => {
      connection = new LDAPConnection(
        {
          ldapServer: `ldap://invalid.host:9999,${server.url}`,
          ldapBase: server.baseDN,
          managerDn: server.adminDN,
          managerPassword: server.adminPassword,
          ldapTimeout: 1000,
        },
        mockLogger,
      );

      await connection.connect();
      expect(connection.isConnected()).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe("bind", () => {
    beforeEach(async () => {
      connection = new LDAPConnection(
        {
          ldapServer: server.url,
          ldapBase: server.baseDN,
          managerDn: server.adminDN,
          managerPassword: server.adminPassword,
        },
        mockLogger,
      );
      await connection.connect();
    });

    it("should bind with manager credentials", async () => {
      const result = await connection.bind();
      expect(result).toBe(true);
    });

    it("should bind with explicit credentials", async () => {
      const result = await connection.bind(
        server.adminDN,
        server.adminPassword,
      );
      expect(result).toBe(true);
    });

    it("should fail with wrong credentials", async () => {
      const result = await connection.bind(server.adminDN, "wrongpassword");
      expect(result).toBe(false);
    });
  });

  describe("userBind", () => {
    beforeEach(async () => {
      connection = new LDAPConnection(
        {
          ldapServer: server.url,
          ldapBase: server.baseDN,
          managerDn: server.adminDN,
          managerPassword: server.adminPassword,
        },
        mockLogger,
      );
      await connection.connect();
    });

    it("should authenticate valid user", async () => {
      const result = await connection.userBind(
        "uid=dwho,ou=users,dc=example,dc=com",
        "dwho",
      );
      expect(result.success).toBe(true);
    });

    it("should reject invalid password", async () => {
      const result = await connection.userBind(
        "uid=dwho,ou=users,dc=example,dc=com",
        "wrongpassword",
      );
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("PE_BADCREDENTIALS");
    });

    it("should reject unknown user", async () => {
      const result = await connection.userBind(
        "uid=unknown,ou=users,dc=example,dc=com",
        "password",
      );
      expect(result.success).toBe(false);
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      connection = new LDAPConnection(
        {
          ldapServer: server.url,
          ldapBase: server.baseDN,
          managerDn: server.adminDN,
          managerPassword: server.adminPassword,
        },
        mockLogger,
      );
      await connection.connect();
      await connection.bind();
    });

    it("should search for users", async () => {
      const results = await connection.search({
        filter: "(objectClass=inetOrgPerson)",
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].dn).toBeDefined();
    });

    it("should search for specific user", async () => {
      const results = await connection.search({
        filter: "(uid=dwho)",
      });
      expect(results).toHaveLength(1);
      expect(results[0].uid).toBe("dwho");
    });

    it("should return empty array for no matches", async () => {
      const results = await connection.search({
        filter: "(uid=nonexistent)",
      });
      expect(results).toHaveLength(0);
    });
  });

  describe("searchUser", () => {
    beforeEach(async () => {
      connection = new LDAPConnection(
        {
          ldapServer: server.url,
          ldapBase: server.baseDN,
          managerDn: server.adminDN,
          managerPassword: server.adminPassword,
          AuthLDAPFilter: "(&(uid=$user)(objectClass=inetOrgPerson))",
        },
        mockLogger,
      );
      await connection.connect();
      await connection.bind();
    });

    it("should find user by username", async () => {
      const user = await connection.searchUser("dwho");
      expect(user).not.toBeNull();
      expect(user!.uid).toBe("dwho");
      expect(user!.cn).toBe("Doctor Who");
    });

    it("should return null for unknown user", async () => {
      const user = await connection.searchUser("unknown");
      expect(user).toBeNull();
    });
  });

  describe("searchGroups", () => {
    beforeEach(async () => {
      connection = new LDAPConnection(
        {
          ldapServer: server.url,
          ldapBase: server.baseDN,
          managerDn: server.adminDN,
          managerPassword: server.adminPassword,
          ldapGroupBase: "ou=groups,dc=example,dc=com",
          ldapGroupObjectClass: "groupOfNames",
          ldapGroupAttributeName: "member",
          ldapGroupAttributeNameSearch: "cn",
        },
        mockLogger,
      );
      await connection.connect();
      await connection.bind();
    });

    it("should find groups for user", async () => {
      const groups = await connection.searchGroups(
        "uid=dwho,ou=users,dc=example,dc=com",
      );
      expect(Object.keys(groups).length).toBeGreaterThan(0);
    });
  });

  describe("validateConnection", () => {
    it("should reconnect if connection lost", async () => {
      connection = new LDAPConnection(
        {
          ldapServer: server.url,
          ldapBase: server.baseDN,
          managerDn: server.adminDN,
          managerPassword: server.adminPassword,
        },
        mockLogger,
      );

      // First connect
      await connection.connect();
      expect(connection.isConnected()).toBe(true);

      // Validate should succeed
      const isValid = await connection.validateConnection();
      expect(isValid).toBe(true);
    });
  });

  describe("getLdapValue", () => {
    beforeEach(async () => {
      connection = new LDAPConnection(
        {
          ldapServer: server.url,
          ldapBase: server.baseDN,
          managerDn: server.adminDN,
          managerPassword: server.adminPassword,
          multiValuesSeparator: ";",
        },
        mockLogger,
      );
      await connection.connect();
      await connection.bind();
    });

    it("should get single attribute value", async () => {
      const user = await connection.searchUser("dwho");
      expect(user).not.toBeNull();
      const cn = connection.getLdapValue(user!, "cn");
      expect(cn).toBe("Doctor Who");
    });
  });

  describe("close", () => {
    it("should close connection", async () => {
      connection = new LDAPConnection(
        {
          ldapServer: server.url,
          ldapBase: server.baseDN,
        },
        mockLogger,
      );

      await connection.connect();
      expect(connection.isConnected()).toBe(true);

      await connection.close();
      expect(connection.isConnected()).toBe(false);
    });
  });
});
