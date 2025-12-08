#!/usr/bin/env node

/**
 * Demo server for LemonLDAP::NG Portal with PostgreSQL backend
 *
 * Requirements:
 *   docker-compose up -d    # Start PostgreSQL (yadd/lemonldap-ng-pg-database)
 *
 * PostgreSQL provides:
 *   - Configuration storage (lmConfig table)
 *   - Session storage (sessions table)
 *   - Authentication (users table - created by this script)
 */

const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 19876;

// PostgreSQL connection settings (matches docker-compose.yml)
const PG_HOST = process.env.PG_HOST || "localhost";
const PG_PORT = process.env.PG_PORT || "5432";
const PG_DATABASE = process.env.PG_DATABASE || "lemonldapng";
const PG_USER = process.env.PG_USER || "lemonldap";
const PG_PASSWORD = process.env.PG_PASSWORD || "lemonldap";

// DBI connection string for perl-dbi
const DBI_CHAIN = `dbi:Pg:dbname=${PG_DATABASE};host=${PG_HOST};port=${PG_PORT}`;

async function main() {
  console.log("Starting LemonLDAP::NG Portal with PostgreSQL backend...\n");

  // Import Knex for database setup
  const PerlDBI = require("perl-dbi").default;

  // Connect to PostgreSQL
  console.log(`[DB] Connecting to PostgreSQL at ${PG_HOST}:${PG_PORT}...`);
  const db = PerlDBI({
    dbiChain: DBI_CHAIN,
    dbiUser: PG_USER,
    dbiPassword: PG_PASSWORD,
  });

  // Check connection
  try {
    await db.raw("SELECT 1");
    console.log("[DB] Connected to PostgreSQL");
  } catch (err) {
    console.error("[DB] Failed to connect to PostgreSQL:", err.message);
    console.error("\nMake sure PostgreSQL is running:");
    console.error("  docker-compose up -d");
    process.exit(1);
  }

  // Create users table if it doesn't exist
  // Note: lemonldap user doesn't have CREATE privilege, use postgres superuser
  const hasUsersTable = await db.schema.hasTable("users");
  if (!hasUsersTable) {
    console.log("[DB] Creating users table (using postgres superuser)...");

    // Connect with superuser to create the table
    const adminDb = PerlDBI({
      dbiChain: DBI_CHAIN,
      dbiUser: "postgres",
      dbiPassword: process.env.POSTGRES_PASSWORD || "postgres",
    });

    try {
      await adminDb.schema.createTable("users", (table) => {
        table.string("user_id").primary();
        table.string("password");
        table.string("name");
        table.string("mail");
        table.string("department");
        table.string("phone");
      });

      // Grant permissions to lemonldap user
      await adminDb.raw("GRANT ALL PRIVILEGES ON TABLE users TO lemonldap");

      // Insert test users
      await adminDb("users").insert([
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
          name: "Frederic Accents",
          mail: "french@example.com",
          department: "Departement Francais",
          phone: "+33123456",
        },
      ]);

      await adminDb.destroy();
      console.log("[DB] Test users created");
    } catch (err) {
      await adminDb.destroy();
      throw err;
    }
  } else {
    console.log("[DB] Users table already exists");
  }

  // Check if configuration exists, if not create initial config
  // Note: PostgreSQL table name is lowercase
  const configExists = await db("lmconfig").count("cfgnum as count").first();
  if (!configExists || configExists.count === "0") {
    console.log("[DB] Creating initial configuration...");

    const initialConfig = {
      cfgNum: 1,
      cfgAuthor: "start-dbi.js",
      cfgDate: Math.floor(Date.now() / 1000),
      cfgVersion: "0.1.0",

      // Portal settings
      portal: `http://localhost:${PORT}`,
      domain: "localhost",

      // Authentication: DBI
      authentication: "DBI",
      userDB: "DBI",
      passwordDB: "DBI",

      // DBI settings
      dbiAuthChain: DBI_CHAIN,
      dbiAuthUser: PG_USER,
      dbiAuthPassword: PG_PASSWORD,
      dbiAuthTable: "users",
      dbiAuthLoginCol: "user_id",
      dbiAuthPasswordCol: "password",

      // UserDB DBI settings
      dbiUserChain: DBI_CHAIN,
      dbiUserUser: PG_USER,
      dbiUserPassword: PG_PASSWORD,
      dbiUserTable: "users",
      dbiUserLoginCol: "user_id",

      // Password settings
      dbiDynamicHashEnabled: 1,
      dbiDynamicHashNewPasswordScheme: "SHA256",
      portalRequireOldPassword: 1,

      // Exported variables
      dbiExportedVars: {
        uid: "user_id",
        cn: "name",
        mail: "mail",
        department: "department",
        phone: "phone",
      },
      exportedVars: {
        uid: "user_id",
        cn: "name",
        mail: "mail",
      },

      // Session storage: PostgreSQL
      globalStorage: "Apache::Session::Browseable::PgJSON",
      globalStorageOptions: {
        DataSource: DBI_CHAIN,
        UserName: PG_USER,
        Password: PG_PASSWORD,
        TableName: "sessions",
        Commit: 1,
      },

      // Security
      key: crypto.randomBytes(16).toString("hex"),
      cookieName: "lemonldap",
      securedCookie: 0, // Allow HTTP for local dev
      httpOnly: 1,
      timeout: 72000,
      timeoutActivity: 0,
      timeoutActivityInterval: 60,

      // Logging
      whatToTrace: "_whatToTrace",
      hiddenAttributes: "password",
    };

    await db("lmconfig").insert({
      cfgnum: 1,
      data: JSON.stringify(initialConfig),
    });
    console.log("[DB] Initial configuration created");
  } else {
    console.log("[DB] Configuration already exists");
  }

  // Import portal components
  const express = require("express");
  const cookieParser = require("cookie-parser");
  const nunjucks = require("nunjucks");
  const Session = require("@lemonldap-ng/session");

  // Import DBI modules
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

  // Load configuration from PostgreSQL
  const confRow = await db("lmconfig")
    .orderBy("cfgnum", "desc")
    .first();
  const conf = JSON.parse(confRow.data);
  console.log(`[CONF] Loaded configuration #${conf.cfgNum}`);

  // Initialize session storage (PostgreSQL)
  console.log("[SESSION] Initializing PostgreSQL session storage...");
  const sessionAcc = new Session({
    storageModule: conf.globalStorage,
    storageModuleOptions: conf.globalStorageOptions,
  });
  await sessionAcc.ready;
  console.log("[SESSION] Session storage ready");

  // Simple Nunjucks setup
  const viewsPath = path.join(__dirname, "../lib/templates/views");
  nunjucks.configure(viewsPath, {
    autoescape: true,
    express: app,
  });

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
  await authModule.init(conf, logger);
  console.log("[AUTH] DBI Auth module initialized (PostgreSQL)");

  const userDBModule = new DBIUserDB();
  await userDBModule.init(conf, logger);
  console.log("[USERDB] DBI UserDB module initialized (PostgreSQL)");

  const passwordModule = new DBIPassword();
  await passwordModule.init(conf, logger);
  console.log("[PASSWORD] DBI Password module initialized (PostgreSQL)");

  // Session middleware - read from PostgreSQL
  app.use(async (req, res, next) => {
    const sessionId = req.cookies?.lemonldap;
    if (sessionId) {
      try {
        const session = await sessionAcc.get(sessionId);
        req.session = session;
        req.sessionId = sessionId;
      } catch {
        // Session not found or expired
      }
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

    // Authenticate with DBI (PostgreSQL)
    const authResult = await authModule.authenticate(credentials);

    if (!authResult.success) {
      return res.render("login.njk", {
        PORTAL: "/",
        AUTH_ERROR: authResult.error || "Authentication failed",
        AUTH_ERROR_CODE: authResult.errorCode,
        LOGIN: credentials.user,
      });
    }

    // Get user data from DBI (PostgreSQL)
    const userData = await userDBModule.getUser(credentials.user);

    if (!userData) {
      return res.render("login.njk", {
        PORTAL: "/",
        AUTH_ERROR: "User data not found",
        AUTH_ERROR_CODE: "PE_USERNOTFOUND",
        LOGIN: credentials.user,
      });
    }

    // Create session in PostgreSQL
    const sessionId = crypto.randomBytes(32).toString("hex");
    const now = Math.floor(Date.now() / 1000);

    const session = {
      _session_id: sessionId,
      _utime: now,
      _lastSeen: now,
      _user: credentials.user,
      _userId: credentials.user,
    };

    // Set session info from user data
    userDBModule.setSessionInfo(session, userData);

    // Store session in PostgreSQL
    await db("sessions").insert({
      id: sessionId,
      a_session: JSON.stringify(session),
    });

    res.cookie("lemonldap", sessionId, {
      httpOnly: true,
      path: "/",
    });

    console.log(
      `[${new Date().toISOString()}] Login: ${credentials.user} -> session ${sessionId.substring(0, 8)}... (PostgreSQL)`,
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

    const userId = req.session._userId || req.session.uid;
    if (!userId) {
      return res.render("password.njk", {
        PORTAL: "/",
        session: req.session,
        PASSWORD_ERROR: "Unable to change password: user ID not found",
        PASSWORD_ERROR_CODE: "PE_ERROR",
      });
    }

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
      `[${new Date().toISOString()}] Password changed for ${req.session.uid} (${userId}) in PostgreSQL`,
    );

    res.render("password.njk", {
      PORTAL: "/",
      session: req.session,
      PASSWORD_SUCCESS: true,
      PASSWORD_MESSAGE: "Password changed successfully",
    });
  });

  // GET /logout - Logout
  app.get("/logout", async (req, res) => {
    if (req.sessionId) {
      const session = req.session;
      // Delete session from PostgreSQL
      await db("sessions").where("id", req.sessionId).del();
      console.log(
        `[${new Date().toISOString()}] Logout: ${session?.uid || "unknown"} (session ${req.sessionId.substring(0, 8)}... deleted from PostgreSQL)`,
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
    await sessionAcc.close?.();
    await db.destroy();
    console.log("[DB] PostgreSQL connections closed");
    console.log("Goodbye!");
    process.exit(0);
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`
+============================================================+
|      LemonLDAP::NG Portal - PostgreSQL Backend             |
+============================================================+
|  Portal running at: http://localhost:${PORT.toString().padEnd(5)}                |
|                                                            |
|  PostgreSQL: ${PG_HOST}:${PG_PORT}/${PG_DATABASE.padEnd(25)}|
|    - Configuration: lmConfig table                         |
|    - Sessions: sessions table                              |
|    - Users: users table                                    |
|                                                            |
|  Test accounts (DBI/PostgreSQL):                           |
|    - dwho / dwho         (Doctor Who)                      |
|    - rtyler / rtyler     (Rose Tyler)                      |
|    - msmith / msmith     (Mickey Smith)                    |
|    - hashed / secret     (SHA256 password)                 |
|    - french / french     (UTF-8 test)                      |
|                                                            |
|  Features:                                                 |
|    - SQL Authentication (plaintext + dynamic hash)         |
|    - SQL User Database                                     |
|    - SQL Session Storage (JSONB)                           |
|    - SQL Configuration Storage                             |
|    - Password Change (stored as {SHA256}base64)            |
|                                                            |
|  Set DEBUG=1 for verbose logging                           |
|  Press Ctrl+C to stop                                      |
+============================================================+
`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
