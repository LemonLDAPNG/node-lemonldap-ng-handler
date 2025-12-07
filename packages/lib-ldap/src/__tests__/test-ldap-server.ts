/**
 * Mock LDAP server for testing
 * Uses ldapjs to create a local LDAP server
 */
import ldap from "ldapjs";

/**
 * Password policy state for a user
 */
export interface TestUserPpolicyState {
  /** User must change password after reset */
  pwdReset?: boolean;
  /** Account is locked until this date */
  pwdAccountLockedTime?: Date;
  /** Time when password was last changed */
  pwdChangedTime?: Date;
  /** Password max age in seconds */
  pwdMaxAge?: number;
  /** Warning before expiration in seconds */
  pwdExpireWarning?: number;
  /** Number of grace logins remaining */
  pwdGraceAuthnLimit?: number;
  /** Times of grace authentications used */
  pwdGraceUseTime?: Date[];
  /** Minimum password length */
  pwdMinLength?: number;
}

export interface TestUser {
  dn: string;
  password: string;
  attributes: Record<string, string | string[]>;
  /** Password policy state */
  ppolicy?: TestUserPpolicyState;
}

export interface TestGroup {
  dn: string;
  cn: string;
  members: string[];
}

export interface TestLDAPServerOptions {
  port?: number;
  baseDN?: string;
  adminDN?: string;
  adminPassword?: string;
  users?: TestUser[];
  groups?: TestGroup[];
  /** Enable password policy control support */
  ppolicyEnabled?: boolean;
  /** Default password policy for all users */
  ppolicyDefault?: TestUserPpolicyState;
}

/** Password Policy Control OID (RFC 3876) */
const PPOLICY_CONTROL_OID = "1.3.6.1.4.1.42.2.27.8.5.1";

/** Password Modify Extended Operation OID (RFC 3062) */
const PASSWD_MODIFY_OID = "1.3.6.1.4.1.4203.1.11.1";

/** PPolicy error codes */
const PPOLICY_ERROR = {
  passwordExpired: 0,
  accountLocked: 1,
  changeAfterReset: 2,
  passwordModNotAllowed: 3,
  mustSupplyOldPassword: 4,
  insufficientPasswordQuality: 5,
  passwordTooShort: 6,
  passwordTooYoung: 7,
  passwordInHistory: 8,
};

const DEFAULT_OPTIONS: Required<TestLDAPServerOptions> = {
  port: 3890,
  baseDN: "dc=example,dc=com",
  adminDN: "cn=admin,dc=example,dc=com",
  adminPassword: "admin",
  ppolicyEnabled: false,
  ppolicyDefault: {},
  users: [
    {
      dn: "uid=dwho,ou=users,dc=example,dc=com",
      password: "dwho",
      attributes: {
        objectClass: ["inetOrgPerson", "top"],
        uid: "dwho",
        cn: "Doctor Who",
        sn: "Who",
        givenName: "Doctor",
        mail: "dwho@example.com",
      },
    },
    {
      dn: "uid=rtyler,ou=users,dc=example,dc=com",
      password: "rtyler",
      attributes: {
        objectClass: ["inetOrgPerson", "top"],
        uid: "rtyler",
        cn: "Rose Tyler",
        sn: "Tyler",
        givenName: "Rose",
        mail: "rtyler@example.com",
      },
    },
  ],
  groups: [
    {
      dn: "cn=admins,ou=groups,dc=example,dc=com",
      cn: "admins",
      members: ["uid=dwho,ou=users,dc=example,dc=com"],
    },
    {
      dn: "cn=users,ou=groups,dc=example,dc=com",
      cn: "users",
      members: [
        "uid=dwho,ou=users,dc=example,dc=com",
        "uid=rtyler,ou=users,dc=example,dc=com",
      ],
    },
  ],
};

export class TestLDAPServer {
  private server: ldap.Server;
  private options: Required<TestLDAPServerOptions>;
  private users: Map<string, TestUser> = new Map();
  private groups: Map<string, TestGroup> = new Map();

  constructor(options: TestLDAPServerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.server = ldap.createServer();

    // Load users and groups
    for (const user of this.options.users) {
      this.users.set(user.dn.toLowerCase(), user);
    }
    for (const group of this.options.groups) {
      this.groups.set(group.dn.toLowerCase(), group);
    }

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Bind handler with ppolicy support
    this.server.bind(this.options.baseDN, (req: any, res: any, next: any) => {
      const dn = req.dn.toString().toLowerCase();
      const password = req.credentials;

      // Check if ppolicy control was requested
      const hasPpolicyControl = req.controls?.some(
        (c: any) => c.type === PPOLICY_CONTROL_OID,
      );

      // Admin bind
      if (dn === this.options.adminDN.toLowerCase()) {
        if (password === this.options.adminPassword) {
          res.end();
          return next();
        }
        return next(new ldap.InvalidCredentialsError());
      }

      // User bind
      const user = this.users.get(dn);
      if (!user) {
        return next(new ldap.InvalidCredentialsError());
      }

      // Check password
      if (user.password !== password) {
        return next(new ldap.InvalidCredentialsError());
      }

      // Handle ppolicy if enabled
      if (this.options.ppolicyEnabled && hasPpolicyControl) {
        const ppolicy = user.ppolicy || this.options.ppolicyDefault || {};
        const ppolicyResponse = this.buildPpolicyResponse(ppolicy);

        if (ppolicyResponse.error !== undefined) {
          // Return error with ppolicy control
          const err = new ldap.InvalidCredentialsError();
          (err as any).controls = [
            {
              type: PPOLICY_CONTROL_OID,
              value: ppolicyResponse,
            },
          ];
          return next(err);
        }

        // Add ppolicy control to response if there are warnings
        if (
          ppolicyResponse.graceAuthNsRemaining !== undefined ||
          ppolicyResponse.timeBeforeExpiration !== undefined
        ) {
          res.controls = [
            {
              type: PPOLICY_CONTROL_OID,
              value: ppolicyResponse,
            },
          ];
        }
      }

      res.end();
      return next();
    });

    // Search handler
    this.server.search(this.options.baseDN, (req: any, res: any, next: any) => {
      const base = req.dn.toString().toLowerCase();
      const filter = req.filter;

      // Search users
      for (const [dn, user] of this.users) {
        if (this.matchesBase(dn, base, req.scope)) {
          if (this.matchesFilter(user.attributes, filter)) {
            res.send({
              dn: user.dn,
              attributes: user.attributes,
            });
          }
        }
      }

      // Search groups
      for (const [dn, group] of this.groups) {
        if (this.matchesBase(dn, base, req.scope)) {
          const groupAttrs = {
            objectClass: ["groupOfNames", "top"],
            cn: group.cn,
            member: group.members,
          };
          if (this.matchesFilter(groupAttrs, filter)) {
            res.send({
              dn: group.dn,
              attributes: groupAttrs,
            });
          }
        }
      }

      res.end();
      return next();
    });

    // Root DSE (for connection testing)
    this.server.search("", (req: any, res: any, next: any) => {
      if (req.scope === "base") {
        res.send({
          dn: "",
          attributes: {
            supportedLDAPVersion: ["3"],
            namingContexts: [this.options.baseDN],
            supportedExtension: [PASSWD_MODIFY_OID],
          },
        });
      }
      res.end();
      return next();
    });

    // Modify handler (for password changes)
    this.server.modify(this.options.baseDN, (req: any, res: any, next: any) => {
      const dn = req.dn.toString().toLowerCase();
      const user = this.users.get(dn);

      if (!user) {
        return next(new ldap.NoSuchObjectError());
      }

      // Process modifications
      for (const change of req.changes) {
        const attrType = change.modification.type.toLowerCase();

        if (attrType === "userpassword") {
          const newPassword = change.modification.values?.[0];
          if (newPassword) {
            // Check password policy
            if (this.options.ppolicyEnabled) {
              const ppolicy = user.ppolicy || this.options.ppolicyDefault || {};

              // Check account locked
              if (ppolicy.pwdAccountLockedTime) {
                const err = new ldap.UnwillingToPerformError(
                  "Account is locked",
                );
                (err as any).controls = [
                  {
                    type: PPOLICY_CONTROL_OID,
                    value: { error: PPOLICY_ERROR.accountLocked },
                  },
                ];
                return next(err);
              }

              // Check minimum length
              if (
                ppolicy.pwdMinLength &&
                newPassword.length < ppolicy.pwdMinLength
              ) {
                const err = new ldap.ConstraintViolationError(
                  "Password too short",
                );
                (err as any).controls = [
                  {
                    type: PPOLICY_CONTROL_OID,
                    value: { error: PPOLICY_ERROR.passwordTooShort },
                  },
                ];
                return next(err);
              }
            }

            // Update password
            user.password = newPassword;

            // Clear pwdReset flag after successful change
            if (user.ppolicy?.pwdReset) {
              user.ppolicy.pwdReset = false;
            }
          }
        }
      }

      res.end();
      return next();
    });

    // Unbind handler (needed for clean client disconnection)
    this.server.unbind((req: any, res: any, next: any) => {
      res.end();
      return next();
    });

    // Extended operation handler (for SetPassword RFC 3062)
    this.server.exop(PASSWD_MODIFY_OID, (req: any, res: any, next: any) => {
      // Parse the request value (BER encoded PasswdModifyRequestValue)
      // For simplicity, we'll extract from the raw request
      const requestValue = req.requestValue;

      if (!requestValue) {
        return next(new ldap.ProtocolError("Missing request value"));
      }

      try {
        // Simple parsing - in real implementation would use BER decoder
        // The request contains: userIdentity [0], oldPasswd [1], newPasswd [2]
        const parsed = this.parsePasswdModifyRequest(requestValue);

        if (!parsed.userIdentity) {
          return next(new ldap.ProtocolError("Missing user identity"));
        }

        const dn = parsed.userIdentity.toLowerCase();
        const user = this.users.get(dn);

        if (!user) {
          return next(new ldap.NoSuchObjectError());
        }

        // Verify old password if provided
        if (parsed.oldPasswd && user.password !== parsed.oldPasswd) {
          return next(new ldap.InvalidCredentialsError());
        }

        // Check password policy
        if (this.options.ppolicyEnabled) {
          const ppolicy = user.ppolicy || this.options.ppolicyDefault || {};

          if (ppolicy.pwdAccountLockedTime) {
            return next(new ldap.UnwillingToPerformError("Account is locked"));
          }

          if (
            ppolicy.pwdMinLength &&
            parsed.newPasswd &&
            parsed.newPasswd.length < ppolicy.pwdMinLength
          ) {
            return next(
              new ldap.ConstraintViolationError("Password too short"),
            );
          }
        }

        // Update password
        if (parsed.newPasswd) {
          user.password = parsed.newPasswd;

          // Clear pwdReset flag
          if (user.ppolicy?.pwdReset) {
            user.ppolicy.pwdReset = false;
          }
        }

        res.end();
        return next();
      } catch (e: any) {
        return next(new ldap.ProtocolError(e.message));
      }
    });
  }

  /**
   * Build ppolicy response based on user state
   */
  private buildPpolicyResponse(ppolicy: TestUserPpolicyState): {
    error?: number;
    graceAuthNsRemaining?: number;
    timeBeforeExpiration?: number;
  } {
    const response: {
      error?: number;
      graceAuthNsRemaining?: number;
      timeBeforeExpiration?: number;
    } = {};

    // Check account locked
    if (ppolicy.pwdAccountLockedTime) {
      response.error = PPOLICY_ERROR.accountLocked;
      return response;
    }

    // Check password expired
    if (ppolicy.pwdChangedTime && ppolicy.pwdMaxAge) {
      const expirationTime =
        ppolicy.pwdChangedTime.getTime() + ppolicy.pwdMaxAge * 1000;
      const now = Date.now();

      if (now >= expirationTime) {
        // Password expired - check grace logins
        if (ppolicy.pwdGraceAuthnLimit && ppolicy.pwdGraceAuthnLimit > 0) {
          const graceUsed = ppolicy.pwdGraceUseTime?.length || 0;
          const graceRemaining = ppolicy.pwdGraceAuthnLimit - graceUsed;

          if (graceRemaining > 0) {
            response.graceAuthNsRemaining = graceRemaining;
            return response;
          }
        }
        response.error = PPOLICY_ERROR.passwordExpired;
        return response;
      }

      // Check expiration warning
      if (ppolicy.pwdExpireWarning) {
        const warningTime = expirationTime - ppolicy.pwdExpireWarning * 1000;
        if (now >= warningTime) {
          response.timeBeforeExpiration = Math.floor(
            (expirationTime - now) / 1000,
          );
        }
      }
    }

    // Check must change after reset
    if (ppolicy.pwdReset) {
      response.error = PPOLICY_ERROR.changeAfterReset;
      return response;
    }

    return response;
  }

  /**
   * Parse PasswdModifyRequest value (simplified BER parsing)
   */
  private parsePasswdModifyRequest(value: Buffer): {
    userIdentity?: string;
    oldPasswd?: string;
    newPasswd?: string;
  } {
    const result: {
      userIdentity?: string;
      oldPasswd?: string;
      newPasswd?: string;
    } = {};

    let offset = 0;

    // Skip SEQUENCE tag and length
    if (value[offset] === 0x30) {
      offset++;
      // Skip length (simple case: single byte length)
      if (value[offset] < 128) {
        offset++;
      } else {
        const lenBytes = value[offset] & 0x7f;
        offset += 1 + lenBytes;
      }
    }

    // Parse context-specific tagged values
    while (offset < value.length) {
      const tag = value[offset];
      offset++;

      const length = value[offset];
      offset++;

      const data = value.slice(offset, offset + length);
      offset += length;

      switch (tag) {
        case 0x80: // userIdentity [0]
          result.userIdentity = data.toString("utf-8");
          break;
        case 0x81: // oldPasswd [1]
          result.oldPasswd = data.toString("utf-8");
          break;
        case 0x82: // newPasswd [2]
          result.newPasswd = data.toString("utf-8");
          break;
      }
    }

    return result;
  }

  private matchesBase(dn: string, base: string, scope: string): boolean {
    if (scope === "base") {
      return dn === base;
    }
    if (scope === "one") {
      // One level below base
      const dnParts = dn.split(",");
      const baseParts = base.split(",");
      return dnParts.length === baseParts.length + 1 && dn.endsWith(base);
    }
    // Subtree (default)
    return dn.endsWith(base) || dn === base;
  }

  private matchesFilter(
    attributes: Record<string, string | string[]>,
    filter: any,
  ): boolean {
    // Use filter.matches() if available (ldapjs built-in method)
    if (typeof filter.matches === "function") {
      // Convert attributes to the format ldapjs expects
      const obj: Record<string, string | string[]> = {};
      for (const [key, value] of Object.entries(attributes)) {
        obj[key.toLowerCase()] = value;
      }
      return filter.matches(obj);
    }

    // Fallback: Simple filter matching by filter type name
    const filterType =
      filter.type || filter.constructor?.name || String(filter);

    if (filterType.includes("Present") || filterType === "present") {
      return attributes[filter.attribute] !== undefined;
    }

    if (
      filterType.includes("Equality") ||
      filterType === "equal" ||
      filterType === "EqualityMatch"
    ) {
      const attr = filter.attribute.toLowerCase();
      const value = String(filter.value || "").toLowerCase();
      const attrValue = attributes[attr];

      if (attrValue === undefined) return false;

      if (Array.isArray(attrValue)) {
        return attrValue.some((v) => String(v).toLowerCase() === value);
      }
      return String(attrValue).toLowerCase() === value;
    }

    if (filterType.includes("And") || filterType === "and") {
      return filter.filters.every((f: any) =>
        this.matchesFilter(attributes, f),
      );
    }

    if (filterType.includes("Or") || filterType === "or") {
      return filter.filters.some((f: any) => this.matchesFilter(attributes, f));
    }

    if (filter.type === "not" || filter.type === "Not") {
      return !this.matchesFilter(attributes, filter.filter);
    }

    // For any other filter type, return true (permissive)
    return true;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.options.port, "127.0.0.1", () => {
        resolve();
      });
      this.server.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Set a timeout to prevent hanging if close doesn't complete
      const timeout = setTimeout(() => {
        resolve();
      }, 5000);

      this.server.close(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  get port(): number {
    return this.options.port;
  }

  get baseDN(): string {
    return this.options.baseDN;
  }

  get adminDN(): string {
    return this.options.adminDN;
  }

  get adminPassword(): string {
    return this.options.adminPassword;
  }

  get url(): string {
    return `ldap://127.0.0.1:${this.options.port}`;
  }

  /**
   * Set ppolicy state for a user (for testing)
   */
  setUserPpolicy(dn: string, ppolicy: TestUserPpolicyState): boolean {
    const user = this.users.get(dn.toLowerCase());
    if (!user) return false;
    user.ppolicy = { ...user.ppolicy, ...ppolicy };
    return true;
  }

  /**
   * Get a user (for testing verification)
   */
  getUser(dn: string): TestUser | undefined {
    return this.users.get(dn.toLowerCase());
  }

  /**
   * Update user password directly (for testing setup)
   */
  setUserPassword(dn: string, password: string): boolean {
    const user = this.users.get(dn.toLowerCase());
    if (!user) return false;
    user.password = password;
    return true;
  }

  /**
   * Add a user dynamically (for testing)
   */
  addUser(user: TestUser): void {
    this.users.set(user.dn.toLowerCase(), user);
  }

  /**
   * Check if ppolicy is enabled
   */
  get ppolicyEnabled(): boolean {
    return this.options.ppolicyEnabled;
  }
}

/**
 * Create and start a test LDAP server
 */
export async function createTestLDAPServer(
  options?: TestLDAPServerOptions,
): Promise<TestLDAPServer> {
  const server = new TestLDAPServer(options);
  await server.start();
  return server;
}
