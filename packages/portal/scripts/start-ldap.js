#!/usr/bin/env node

/**
 * Demo server for LemonLDAP::NG Portal with LDAP authentication
 * Includes a built-in mock LDAP server for testing
 */

const path = require("path");
const ldap = require("ldapjs");

const PORT = process.env.PORT || 19876;
const LDAP_PORT = 3890;

// Test users for mock LDAP
const users = new Map([
  [
    "uid=dwho,ou=users,dc=example,dc=com",
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
  ],
  [
    "uid=rtyler,ou=users,dc=example,dc=com",
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
  [
    "uid=msmith,ou=users,dc=example,dc=com",
    {
      dn: "uid=msmith,ou=users,dc=example,dc=com",
      password: "msmith",
      attributes: {
        objectClass: ["inetOrgPerson", "top"],
        uid: "msmith",
        cn: "Mickey Smith",
        sn: "Smith",
        givenName: "Mickey",
        mail: "msmith@example.com",
      },
    },
  ],
]);

// Test groups
const groups = new Map([
  [
    "cn=admins,ou=groups,dc=example,dc=com",
    {
      dn: "cn=admins,ou=groups,dc=example,dc=com",
      cn: "admins",
      members: ["uid=dwho,ou=users,dc=example,dc=com"],
    },
  ],
  [
    "cn=users,ou=groups,dc=example,dc=com",
    {
      dn: "cn=users,ou=groups,dc=example,dc=com",
      cn: "users",
      members: [
        "uid=dwho,ou=users,dc=example,dc=com",
        "uid=rtyler,ou=users,dc=example,dc=com",
        "uid=msmith,ou=users,dc=example,dc=com",
      ],
    },
  ],
]);

/**
 * Create and start mock LDAP server
 */
async function createMockLDAPServer(port) {
  const server = ldap.createServer();
  const baseDN = "dc=example,dc=com";
  const adminDN = "cn=admin,dc=example,dc=com";
  const adminPassword = "admin";

  // Bind handler
  server.bind(baseDN, (req, res, next) => {
    const dn = req.dn.toString().toLowerCase();
    const password = req.credentials;

    // Admin bind
    if (dn === adminDN.toLowerCase()) {
      if (password === adminPassword) {
        res.end();
        return next();
      }
      return next(new ldap.InvalidCredentialsError());
    }

    // User bind
    const user = users.get(dn);
    if (!user || user.password !== password) {
      return next(new ldap.InvalidCredentialsError());
    }

    res.end();
    return next();
  });

  // Search handler
  server.search(baseDN, (req, res, next) => {
    const base = req.dn.toString().toLowerCase();
    const filter = req.filter;

    // Search users
    for (const [dn, user] of users) {
      if (dn.endsWith(base) || dn === base) {
        if (typeof filter.matches === "function") {
          const obj = {};
          for (const [key, value] of Object.entries(user.attributes)) {
            obj[key.toLowerCase()] = value;
          }
          if (filter.matches(obj)) {
            res.send({ dn: user.dn, attributes: user.attributes });
          }
        } else {
          res.send({ dn: user.dn, attributes: user.attributes });
        }
      }
    }

    // Search groups
    for (const [dn, group] of groups) {
      if (dn.endsWith(base) || dn === base) {
        const groupAttrs = {
          objectClass: ["groupOfNames", "top"],
          cn: group.cn,
          member: group.members,
        };
        if (typeof filter.matches === "function") {
          const obj = {};
          for (const [key, value] of Object.entries(groupAttrs)) {
            obj[key.toLowerCase()] = value;
          }
          if (filter.matches(obj)) {
            res.send({ dn: group.dn, attributes: groupAttrs });
          }
        } else {
          res.send({ dn: group.dn, attributes: groupAttrs });
        }
      }
    }

    res.end();
    return next();
  });

  // Root DSE
  server.search("", (req, res, next) => {
    if (req.scope === "base") {
      res.send({
        dn: "",
        attributes: {
          supportedLDAPVersion: ["3"],
          namingContexts: [baseDN],
        },
      });
    }
    res.end();
    return next();
  });

  // Modify handler (for password changes)
  server.modify(baseDN, (req, res, next) => {
    const dn = req.dn.toString().toLowerCase();
    const user = users.get(dn);

    if (!user) {
      return next(new ldap.NoSuchObjectError());
    }

    for (const change of req.changes) {
      const attrType = change.modification.type.toLowerCase();
      if (attrType === "userpassword") {
        const newPassword = change.modification.values?.[0];
        if (newPassword) {
          user.password = newPassword;
        }
      }
    }

    res.end();
    return next();
  });

  // Unbind handler
  server.unbind((req, res, next) => {
    res.end();
    return next();
  });

  return new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({
        server,
        stop: () =>
          new Promise((res) => {
            const timeout = setTimeout(res, 2000);
            server.close(() => {
              clearTimeout(timeout);
              res();
            });
          }),
      });
    });
    server.on("error", reject);
  });
}

async function main() {
  console.log("Starting LemonLDAP::NG Portal with LDAP backend...\n");

  // Start LDAP server
  console.log(`[LDAP] Starting mock LDAP server on port ${LDAP_PORT}...`);
  const ldapServer = await createMockLDAPServer(LDAP_PORT);
  console.log(`[LDAP] Mock LDAP server ready at ldap://127.0.0.1:${LDAP_PORT}`);

  // Import portal components
  const express = require("express");
  const cookieParser = require("cookie-parser");
  const nunjucks = require("nunjucks");
  const crypto = require("crypto");

  // Import LDAP modules
  const { LDAPAuth } = require("@lemonldap-ng/auth-ldap");
  const { LDAPUserDB } = require("@lemonldap-ng/userdb-ldap");
  const { LDAPPassword } = require("@lemonldap-ng/password-ldap");

  const app = express();

  // Middlewares
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Session store (in-memory for demo)
  const sessions = new Map();

  // Simple Nunjucks setup
  const viewsPath = path.join(__dirname, "../lib/templates/views");
  nunjucks.configure(viewsPath, {
    autoescape: true,
    express: app,
  });

  // LDAP configuration
  const ldapConf = {
    ldapServer: `ldap://127.0.0.1:${LDAP_PORT}`,
    ldapBase: "dc=example,dc=com",
    managerDn: "cn=admin,dc=example,dc=com",
    managerPassword: "admin",
    AuthLDAPFilter: "(&(uid=$user)(objectClass=inetOrgPerson))",
    ldapGroupBase: "ou=groups,dc=example,dc=com",
    ldapGroupObjectClass: "groupOfNames",
    ldapGroupAttributeName: "member",
    ldapGroupAttributeNameSearch: "cn",
    ldapExportedVars: {
      uid: "uid",
      cn: "cn",
      mail: "mail",
      sn: "sn",
      givenName: "givenName",
    },
    portalRequireOldPassword: true,
    portal: "/",
  };

  // Logger
  const logger = {
    error: (...args) => console.error("[ERROR]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    notice: (...args) => console.log("[NOTICE]", ...args),
    info: (...args) => console.log("[INFO]", ...args),
    debug: (...args) => {
      if (process.env.DEBUG) console.log("[DEBUG]", ...args);
    },
  };

  // Initialize LDAP modules
  const authModule = new LDAPAuth();
  await authModule.init(ldapConf, logger);
  console.log("[AUTH] LDAP Auth module initialized");

  const userDBModule = new LDAPUserDB();
  await userDBModule.init(ldapConf, logger);
  console.log("[USERDB] LDAP UserDB module initialized");

  const passwordModule = new LDAPPassword();
  await passwordModule.init(ldapConf, logger);
  console.log("[PASSWORD] LDAP Password module initialized");

  // Session middleware
  app.use((req, res, next) => {
    const sessionId = req.cookies?.lemonldap;
    if (sessionId && sessions.has(sessionId)) {
      req.session = sessions.get(sessionId);
      req.sessionId = sessionId;
    }
    next();
  });

  // GET / - Show login form or menu
  app.get("/", (req, res) => {
    if (req.session) {
      res.render("menu.njk", {
        PORTAL: "/",
        session: req.session,
        HAS_PASSWORD_MODULE: true,
      });
    } else {
      res.render("login.njk", {
        PORTAL: "/",
      });
    }
  });

  // POST / - Process login
  app.post("/", async (req, res) => {
    if (req.session) {
      return res.redirect("/");
    }

    const credentials = authModule.extractCredentials(req);

    if (!credentials) {
      return res.render("login.njk", {
        PORTAL: "/",
        AUTH_ERROR: "Missing credentials",
        AUTH_ERROR_CODE: "PE_FORMEMPTY",
      });
    }

    // Authenticate with LDAP
    const authResult = await authModule.authenticate(credentials);

    if (!authResult.success) {
      return res.render("login.njk", {
        PORTAL: "/",
        AUTH_ERROR: authResult.error || "Authentication failed",
        AUTH_ERROR_CODE: authResult.errorCode,
        LOGIN: credentials.user,
      });
    }

    // Get user data from LDAP
    const userData = await userDBModule.getUser(credentials.user);

    if (!userData) {
      return res.render("login.njk", {
        PORTAL: "/",
        AUTH_ERROR: "User data not found",
        AUTH_ERROR_CODE: "PE_USERNOTFOUND",
        LOGIN: credentials.user,
      });
    }

    // Create session
    const sessionId = crypto.randomBytes(32).toString("hex");
    const now = Math.floor(Date.now() / 1000);

    const session = {
      _session_id: sessionId,
      _utime: now,
      _lastSeen: now,
      _user: credentials.user,
    };

    // Set session info from user data
    userDBModule.setSessionInfo(session, userData);
    sessions.set(sessionId, session);

    res.cookie("lemonldap", sessionId, {
      httpOnly: true,
      path: "/",
    });

    console.log(
      `[${new Date().toISOString()}] Login: ${credentials.user} -> session ${sessionId.substring(0, 8)}...`,
    );

    // Check for redirect URL
    const urldc = req.body.url;
    if (urldc) {
      return res.redirect(urldc);
    }

    res.redirect("/");
  });

  // GET /password - Show password change form
  app.get("/password", (req, res) => {
    if (!req.session) {
      return res.redirect("/");
    }

    res.render("password.njk", {
      PORTAL: "/",
      session: req.session,
    });
  });

  // POST /password - Process password change
  app.post("/password", async (req, res) => {
    if (!req.session) {
      return res.redirect("/");
    }

    const { oldPassword, newPassword, confirmPassword } = req.body;

    // Validate form data
    if (!newPassword) {
      return res.render("password.njk", {
        PORTAL: "/",
        session: req.session,
        PASSWORD_ERROR: "New password is required",
        PASSWORD_ERROR_CODE: "PE_PASSWORD_MISSING",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.render("password.njk", {
        PORTAL: "/",
        session: req.session,
        PASSWORD_ERROR: "Passwords do not match",
        PASSWORD_ERROR_CODE: "PE_PASSWORD_MISMATCH",
      });
    }

    // Get user DN from session
    const userDn = req.session._dn;
    if (!userDn) {
      return res.render("password.njk", {
        PORTAL: "/",
        session: req.session,
        PASSWORD_ERROR: "Unable to change password: user DN not found",
        PASSWORD_ERROR_CODE: "PE_ERROR",
      });
    }

    // Call password module
    const result = await passwordModule.modifyPassword(userDn, newPassword, {
      oldPassword,
    });

    if (!result.success) {
      console.log(
        `[${new Date().toISOString()}] Password change failed for ${userDn}: ${result.error}`,
      );
      return res.render("password.njk", {
        PORTAL: "/",
        session: req.session,
        PASSWORD_ERROR: result.error || "Password change failed",
        PASSWORD_ERROR_CODE: result.errorCode,
      });
    }

    console.log(
      `[${new Date().toISOString()}] Password changed for ${req.session.uid} (${userDn})`,
    );

    // Show success message
    res.render("password.njk", {
      PORTAL: "/",
      session: req.session,
      PASSWORD_SUCCESS: true,
      PASSWORD_MESSAGE: "Password changed successfully",
    });
  });

  // GET /logout - Logout
  app.get("/logout", (req, res) => {
    if (req.sessionId) {
      const session = sessions.get(req.sessionId);
      sessions.delete(req.sessionId);
      console.log(
        `[${new Date().toISOString()}] Logout: ${session?.uid || "unknown"} (session ${req.sessionId.substring(0, 8)}...)`,
      );
    }

    res.clearCookie("lemonldap", { path: "/" });
    res.redirect("/");
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n\nShutting down...");
    await authModule.close?.();
    await userDBModule.close?.();
    await passwordModule.close?.();
    await ldapServer.stop();
    console.log("Goodbye!");
    process.exit(0);
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║      LemonLDAP::NG Portal - LDAP Demo Server               ║
╠════════════════════════════════════════════════════════════╣
║  Portal running at: http://localhost:${PORT.toString().padEnd(5)}                ║
║  LDAP server at:    ldap://127.0.0.1:${LDAP_PORT.toString().padEnd(5)}               ║
║                                                            ║
║  Test accounts (LDAP):                                     ║
║    - dwho / dwho       (Doctor Who)                        ║
║    - rtyler / rtyler   (Rose Tyler)                        ║
║    - msmith / msmith   (Mickey Smith)                      ║
║                                                            ║
║  Features:                                                 ║
║    - LDAP Authentication                                   ║
║    - LDAP User Database (with groups)                      ║
║    - Password Change                                       ║
║                                                            ║
║  Set DEBUG=1 for verbose logging                           ║
║  Press Ctrl+C to stop                                      ║
╚════════════════════════════════════════════════════════════╝
`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
