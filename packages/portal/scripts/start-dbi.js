#!/usr/bin/env node

/**
 * Demo server for LemonLDAP::NG Portal with DBI (SQL) authentication
 * Uses SQLite for embedded database - no external dependencies
 */

const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const PORT = process.env.PORT || 19876;

// Create temp database path
const dbPath = path.join(os.tmpdir(), `llng-demo-${Date.now()}.db`);

async function main() {
  console.log("Starting LemonLDAP::NG Portal with DBI backend...\n");

  // Import Knex for database setup
  const PerlDBI = require("perl-dbi").default;

  // Create and setup database
  console.log(`[DB] Creating SQLite database at ${dbPath}...`);
  const db = PerlDBI({
    dbiChain: `dbi:SQLite:dbname=${dbPath}`,
  });

  // Create users table
  await db.schema.createTable("users", (table) => {
    table.string("user_id").primary();
    table.string("password");
    table.string("name");
    table.string("mail");
    table.string("department");
    table.string("phone");
  });

  // Insert test users with different password formats
  await db("users").insert([
    {
      user_id: "dwho",
      password: "dwho",
      name: "Doctor Who",
      mail: "dwho@example.com",
      department: "Time Lords",
      phone: "+44123456",
    },
    {
      user_id: "rtyler",
      password: "rtyler",
      name: "Rose Tyler",
      mail: "rtyler@example.com",
      department: "Companions",
      phone: "+44987654",
    },
    {
      user_id: "msmith",
      password: "msmith",
      name: "Mickey Smith",
      mail: "msmith@example.com",
      department: "Companions",
      phone: "+44111222",
    },
    // User with SHA256 hashed password
    {
      user_id: "hashed",
      password: `{SHA256}${crypto.createHash("sha256").update("secret").digest("base64")}`,
      name: "Hashed User",
      mail: "hashed@example.com",
      department: "Security",
      phone: "+44333444",
    },
    // UTF-8 users
    {
      user_id: "french",
      password: "french",
      name: "Frédéric Accents",
      mail: "french@example.com",
      department: "Département Français",
      phone: "+33123456",
    },
    {
      user_id: "russian",
      password: "russian",
      name: "Русский Пользователь",
      mail: "russian@example.com",
      department: "Отдел",
      phone: "+7123456",
    },
  ]);

  console.log("[DB] Test users created");

  // Import portal components
  const express = require("express");
  const cookieParser = require("cookie-parser");
  const nunjucks = require("nunjucks");

  // Import DBI modules (handle both ESM and CJS exports)
  const authDbiModule = require("@lemonldap-ng/auth-dbi");
  const userdbDbiModule = require("@lemonldap-ng/userdb-dbi");
  const passwordDbiModule = require("@lemonldap-ng/password-dbi");

  const DBIAuth = authDbiModule.DBIAuth || authDbiModule.default;
  const DBIUserDB = userdbDbiModule.DBIUserDB || userdbDbiModule.default;
  const DBIPassword =
    passwordDbiModule.DBIPassword || passwordDbiModule.default;

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

  // DBI configuration
  const dbiConf = {
    dbiAuthChain: `dbi:SQLite:dbname=${dbPath}`,
    dbiAuthTable: "users",
    dbiAuthLoginCol: "user_id",
    dbiAuthPasswordCol: "password",
    dbiUserTable: "users",
    dbiUserLoginCol: "user_id",
    dbiUserMailCol: "mail",
    dbiDynamicHashEnabled: true,
    dbiDynamicHashNewPasswordScheme: "SHA256",
    dbiExportedVars: {
      uid: "user_id",
      cn: "name",
      mail: "mail",
      department: "department",
      phone: "phone",
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

  // Initialize DBI modules
  const authModule = new DBIAuth();
  await authModule.init(dbiConf, logger);
  console.log("[AUTH] DBI Auth module initialized");

  const userDBModule = new DBIUserDB();
  await userDBModule.init(dbiConf, logger);
  console.log("[USERDB] DBI UserDB module initialized");

  const passwordModule = new DBIPassword();
  await passwordModule.init(dbiConf, logger);
  console.log("[PASSWORD] DBI Password module initialized");

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

    // Authenticate with DBI
    const authResult = await authModule.authenticate(credentials);

    if (!authResult.success) {
      return res.render("login.njk", {
        PORTAL: "/",
        AUTH_ERROR: authResult.error || "Authentication failed",
        AUTH_ERROR_CODE: authResult.errorCode,
        LOGIN: credentials.user,
      });
    }

    // Get user data from DBI
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
      _userId: credentials.user, // Store user ID for password changes
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

    // Get user ID from session
    const userId = req.session._userId || req.session.uid;
    if (!userId) {
      return res.render("password.njk", {
        PORTAL: "/",
        session: req.session,
        PASSWORD_ERROR: "Unable to change password: user ID not found",
        PASSWORD_ERROR_CODE: "PE_ERROR",
      });
    }

    // Call password module
    const result = await passwordModule.modifyPassword(userId, newPassword, {
      oldPassword,
    });

    if (!result.success) {
      console.log(
        `[${new Date().toISOString()}] Password change failed for ${userId}: ${result.error}`,
      );
      return res.render("password.njk", {
        PORTAL: "/",
        session: req.session,
        PASSWORD_ERROR: result.error || "Password change failed",
        PASSWORD_ERROR_CODE: result.errorCode,
      });
    }

    console.log(
      `[${new Date().toISOString()}] Password changed for ${req.session.uid} (${userId})`,
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
    await db.destroy();
    // Clean up temp database
    try {
      fs.unlinkSync(dbPath);
      console.log("[DB] Temporary database removed");
    } catch (e) {
      // Ignore
    }
    console.log("Goodbye!");
    process.exit(0);
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║      LemonLDAP::NG Portal - DBI Demo Server                ║
╠════════════════════════════════════════════════════════════╣
║  Portal running at: http://localhost:${PORT.toString().padEnd(5)}                ║
║  Database: SQLite (embedded, temp file)                    ║
║                                                            ║
║  Test accounts (DBI/SQL):                                  ║
║    - dwho / dwho         (Doctor Who)                      ║
║    - rtyler / rtyler     (Rose Tyler)                      ║
║    - msmith / msmith     (Mickey Smith)                    ║
║    - hashed / secret     (SHA256 password)                 ║
║    - french / french     (UTF-8: Frédéric)                 ║
║    - russian / russian   (UTF-8: Cyrillic)                 ║
║                                                            ║
║  Features:                                                 ║
║    - SQL Authentication (plaintext + dynamic hash)         ║
║    - SQL User Database                                     ║
║    - Password Change (stored as {SHA256}base64)            ║
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
