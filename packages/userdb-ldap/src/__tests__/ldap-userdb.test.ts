import { LDAPUserDB, createUserDBModule } from "../index";
import type { LLNG_Conf, LLNG_Logger, LLNG_Session } from "@lemonldap-ng/types";
import ldap from "ldapjs";

// Mock LDAP server for testing
class MockLDAPServer {
  private server: ldap.Server;
  private port: number;

  private users = new Map([
    [
      "uid=dwho,ou=users,dc=example,dc=com",
      {
        password: "dwho",
        attrs: {
          objectClass: ["inetOrgPerson"],
          uid: "dwho",
          cn: "Doctor Who",
          sn: "Who",
          givenName: "Doctor",
          mail: "dwho@example.com",
          telephoneNumber: "+1234567890",
        },
      },
    ],
    [
      "uid=rtyler,ou=users,dc=example,dc=com",
      {
        password: "rtyler",
        attrs: {
          objectClass: ["inetOrgPerson"],
          uid: "rtyler",
          cn: "Rose Tyler",
          sn: "Tyler",
          givenName: "Rose",
          mail: "rtyler@example.com",
        },
      },
    ],
  ]);

  private groups = new Map([
    [
      "cn=admins,ou=groups,dc=example,dc=com",
      {
        cn: "admins",
        objectClass: ["groupOfNames"],
        member: ["uid=dwho,ou=users,dc=example,dc=com"],
      },
    ],
    [
      "cn=users,ou=groups,dc=example,dc=com",
      {
        cn: "users",
        objectClass: ["groupOfNames"],
        member: [
          "uid=dwho,ou=users,dc=example,dc=com",
          "uid=rtyler,ou=users,dc=example,dc=com",
        ],
      },
    ],
  ]);

  constructor(port: number = 3893) {
    this.port = port;
    this.server = ldap.createServer();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Bind handler
    this.server.bind("dc=example,dc=com", (req: any, res: any, next: any) => {
      const dn = req.dn.toString().toLowerCase();
      const password = req.credentials;

      if (dn === "cn=admin,dc=example,dc=com" && password === "admin") {
        res.end();
        return next();
      }

      const user = this.users.get(dn);
      if (user && user.password === password) {
        res.end();
        return next();
      }

      return next(new ldap.InvalidCredentialsError());
    });

    // Search handler for users
    this.server.search(
      "ou=users,dc=example,dc=com",
      (req: any, res: any, next: any) => {
        for (const [dn, user] of this.users) {
          if (this.matchesFilter(user.attrs, req.filter)) {
            res.send({ dn, attributes: user.attrs });
          }
        }
        res.end();
        return next();
      },
    );

    // Search handler for groups
    this.server.search(
      "ou=groups,dc=example,dc=com",
      (req: any, res: any, next: any) => {
        for (const [dn, group] of this.groups) {
          if (this.matchesFilter(group, req.filter)) {
            res.send({ dn, attributes: group });
          }
        }
        res.end();
        return next();
      },
    );

    // Root DSE
    this.server.search("", (req: any, res: any, next: any) => {
      if (req.scope === "base") {
        res.send({
          dn: "",
          attributes: { supportedLDAPVersion: ["3"] },
        });
      }
      res.end();
      return next();
    });
  }

  private matchesFilter(attrs: Record<string, any>, filter: any): boolean {
    // Use filter.matches() if available (ldapjs built-in method)
    if (typeof filter.matches === "function") {
      const obj: Record<string, any> = {};
      for (const [key, value] of Object.entries(attrs)) {
        obj[key.toLowerCase()] = value;
      }
      return filter.matches(obj);
    }

    const filterType =
      filter.type || filter.constructor?.name || String(filter);

    if (
      filterType.includes("Equality") ||
      filterType === "equal" ||
      filterType === "EqualityMatch"
    ) {
      const attr = filter.attribute.toLowerCase();
      const value = String(filter.value || "").toLowerCase();
      const attrValue = attrs[attr];
      if (!attrValue) return false;
      if (Array.isArray(attrValue)) {
        return attrValue.some((v: any) => String(v).toLowerCase() === value);
      }
      return String(attrValue).toLowerCase() === value;
    }
    if (filterType.includes("And") || filterType === "and") {
      return filter.filters.every((f: any) => this.matchesFilter(attrs, f));
    }
    if (filterType.includes("Or") || filterType === "or") {
      return filter.filters.some((f: any) => this.matchesFilter(attrs, f));
    }
    return true;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, "127.0.0.1", () => resolve());
      this.server.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }

  get url(): string {
    return `ldap://127.0.0.1:${this.port}`;
  }
}

describe("LDAPUserDB", () => {
  let server: MockLDAPServer;
  let userdb: LDAPUserDB;

  const mockLogger: LLNG_Logger = {
    error: jest.fn(),
    warn: jest.fn(),
    notice: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  const createConf = (overrides: Partial<LLNG_Conf> = {}): LLNG_Conf =>
    ({
      cfgNum: 1,
      ldapServer: server.url,
      ldapBase: "ou=users,dc=example,dc=com",
      managerDn: "cn=admin,dc=example,dc=com",
      managerPassword: "admin",
      AuthLDAPFilter: "(&(uid=$user)(objectClass=inetOrgPerson))",
      ldapExportedVars: {
        uid: "uid",
        cn: "cn",
        mail: "mail",
        sn: "sn",
        givenName: "givenName",
        phone: "telephoneNumber",
      },
      ldapGroupBase: "ou=groups,dc=example,dc=com",
      ldapGroupObjectClass: "groupOfNames",
      ldapGroupAttributeName: "member",
      ldapGroupAttributeNameUser: "dn",
      ldapGroupAttributeNameSearch: "cn",
      ...overrides,
    }) as LLNG_Conf;

  beforeAll(async () => {
    server = new MockLDAPServer(3893);
    await server.start();
  });

  afterAll(() => {
    // Server cleanup handled by forceExit - ldapjs server.close() hangs
    server.stop().catch(() => {
      // Ignore cleanup errors
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    userdb = new LDAPUserDB();
  });

  afterEach(async () => {
    if (userdb) {
      await userdb.close();
    }
  });

  describe("factory function", () => {
    it("should create an instance", () => {
      const instance = createUserDBModule();
      expect(instance).toBeInstanceOf(LDAPUserDB);
    });
  });

  describe("init", () => {
    it("should initialize and log exported vars count", async () => {
      await userdb.init(createConf(), mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("exported vars"),
      );
    });
  });

  describe("getUser", () => {
    beforeEach(async () => {
      await userdb.init(createConf(), mockLogger);
    });

    it("should return user data for existing user", async () => {
      const user = await userdb.getUser("dwho");
      expect(user).not.toBeNull();
      expect(user!.uid).toBe("dwho");
      expect(user!.attributes.cn).toBe("Doctor Who");
      expect(user!.attributes.mail).toBe("dwho@example.com");
      expect(user!.attributes.sn).toBe("Who");
    });

    it("should include DN in attributes", async () => {
      const user = await userdb.getUser("dwho");
      expect(user!.attributes._dn).toBe("uid=dwho,ou=users,dc=example,dc=com");
    });

    it("should return null for unknown user", async () => {
      const user = await userdb.getUser("unknown");
      expect(user).toBeNull();
    });

    it("should load groups when configured", async () => {
      const user = await userdb.getUser("dwho");
      expect(user!.groups).toBeDefined();
      expect(user!.groups).toContain("admins");
      expect(user!.groups).toContain("users");
    });

    it("should load only matching groups", async () => {
      const user = await userdb.getUser("rtyler");
      expect(user!.groups).toBeDefined();
      expect(user!.groups).toContain("users");
      expect(user!.groups).not.toContain("admins");
    });
  });

  describe("setSessionInfo", () => {
    beforeEach(async () => {
      await userdb.init(createConf(), mockLogger);
    });

    it("should set session attributes from user data", async () => {
      const user = await userdb.getUser("dwho");
      const session: LLNG_Session = {
        _session_id: "test123",
        _utime: Date.now(),
      };

      userdb.setSessionInfo(session, user!);

      expect(session.uid).toBe("dwho");
      expect(session.cn).toBe("Doctor Who");
      expect(session.mail).toBe("dwho@example.com");
    });

    it("should set groups in session", async () => {
      const user = await userdb.getUser("dwho");
      const session: LLNG_Session = {
        _session_id: "test123",
        _utime: Date.now(),
      };

      userdb.setSessionInfo(session, user!);

      expect(session.groups).toBeDefined();
      expect(session.groups).toContain("admins");
    });

    it("should build hGroups for compatibility", async () => {
      const user = await userdb.getUser("dwho");
      const session: LLNG_Session = {
        _session_id: "test123",
        _utime: Date.now(),
      };

      userdb.setSessionInfo(session, user!);

      const hGroups = (session as any).hGroups;
      expect(hGroups).toBeDefined();
      expect(hGroups.admins).toEqual({ name: "admins" });
    });
  });

  describe("exported vars mapping", () => {
    it("should use ldapExportedVars mapping", async () => {
      await userdb.init(
        createConf({
          ldapExportedVars: {
            fullName: "cn",
            email: "mail",
          },
        }),
        mockLogger,
      );

      const user = await userdb.getUser("dwho");
      expect(user!.attributes.fullName).toBe("Doctor Who");
      expect(user!.attributes.email).toBe("dwho@example.com");
    });
  });

  describe("close", () => {
    it("should close gracefully", async () => {
      await userdb.init(createConf(), mockLogger);
      await userdb.close();
      expect(mockLogger.debug).toHaveBeenCalledWith("LDAP UserDB closed");
    });
  });
});
