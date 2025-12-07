#!/usr/bin/env node

/**
 * Demo server for LemonLDAP::NG Portal
 * Uses demo authentication and userdb modules
 */

const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");

const PORT = process.env.PORT || 19876;

// Simple demo server without full Portal initialization
// This allows testing without a full LLNG configuration

async function main() {
  const app = express();

  // Middlewares
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // Session store (in-memory for demo)
  const sessions = new Map();

  // Demo users
  const demoUsers = {
    dwho: {
      _password: "dwho",
      uid: "dwho",
      cn: "Doctor Who",
      mail: "dwho@example.com",
    },
    rtyler: {
      _password: "rtyler",
      uid: "rtyler",
      cn: "Rose Tyler",
      mail: "rtyler@example.com",
    },
  };

  // Simple Nunjucks setup
  const nunjucks = require("nunjucks");
  const viewsPath = path.join(__dirname, "../lib/templates/views");

  const env = nunjucks.configure(viewsPath, {
    autoescape: true,
    express: app,
  });

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
      });
    } else {
      res.render("login.njk", {
        PORTAL: "/",
      });
    }
  });

  // POST / - Process login
  app.post("/", (req, res) => {
    if (req.session) {
      return res.redirect("/");
    }

    const { user, password } = req.body;

    if (!user || !password) {
      return res.render("login.njk", {
        PORTAL: "/",
        AUTH_ERROR: "Missing credentials",
        AUTH_ERROR_CODE: "PE_FORMEMPTY",
      });
    }

    const userData = demoUsers[user];

    if (!userData || userData._password !== password) {
      return res.render("login.njk", {
        PORTAL: "/",
        AUTH_ERROR: "Invalid username or password",
        AUTH_ERROR_CODE: "PE_BADCREDENTIALS",
        LOGIN: user,
      });
    }

    // Create session
    const crypto = require("crypto");
    const sessionId = crypto.randomBytes(32).toString("hex");
    const now = Math.floor(Date.now() / 1000);

    const session = {
      _session_id: sessionId,
      _utime: now,
      _lastSeen: now,
      uid: userData.uid,
      cn: userData.cn,
      mail: userData.mail,
    };

    sessions.set(sessionId, session);

    res.cookie("lemonldap", sessionId, {
      httpOnly: true,
      path: "/",
    });

    console.log(
      `[${new Date().toISOString()}] Login: ${user} -> session ${sessionId.substring(0, 8)}...`,
    );

    // Check for redirect URL
    const urldc = req.body.url;
    if (urldc) {
      return res.redirect(urldc);
    }

    res.redirect("/");
  });

  // GET /logout - Logout
  app.get("/logout", (req, res) => {
    if (req.sessionId) {
      sessions.delete(req.sessionId);
      console.log(
        `[${new Date().toISOString()}] Logout: session ${req.sessionId.substring(0, 8)}...`,
      );
    }

    res.clearCookie("lemonldap", { path: "/" });
    res.redirect("/");
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           LemonLDAP::NG Portal - Demo Server               ║
╠════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT.toString().padEnd(5)}                ║
║                                                            ║
║  Demo accounts:                                            ║
║    - dwho / dwho     (Doctor Who)                          ║
║    - rtyler / rtyler (Rose Tyler)                          ║
║                                                            ║
║  Press Ctrl+C to stop                                      ║
╚════════════════════════════════════════════════════════════╝
`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
