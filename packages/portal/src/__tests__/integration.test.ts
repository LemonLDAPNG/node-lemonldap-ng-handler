import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";
import { Router } from "express";

// Mock portal and modules for integration test
// We test the route logic without full Portal initialization

describe("Portal Integration", () => {
  let app: express.Application;
  let sessionStore: Map<string, any>;

  beforeEach(() => {
    sessionStore = new Map();
    app = express();
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    const router = Router();

    // Mock session middleware
    router.use((req: any, _res, next) => {
      const sessionId = req.cookies?.lemonldap;
      if (sessionId && sessionStore.has(sessionId)) {
        req.llngSession = sessionStore.get(sessionId);
        req.llngSessionId = sessionId;
      }
      next();
    });

    // Mock auth middleware for demo
    router.use((req: any, _res, next) => {
      if (req.body?.user && req.body?.password) {
        req.llngCredentials = {
          user: req.body.user,
          password: req.body.password,
        };

        // Demo users
        const demoUsers: Record<string, any> = {
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

        const userData = demoUsers[req.body.user];
        if (userData && userData._password === req.body.password) {
          req.llngAuthResult = { success: true, user: req.body.user };
          req.llngUserData = {
            uid: userData.uid,
            attributes: { cn: userData.cn, mail: userData.mail },
          };
        } else {
          req.llngAuthResult = {
            success: false,
            error: "Bad credentials",
            errorCode: "PE_BADCREDENTIALS",
          };
        }
      }
      next();
    });

    // Simplified routes
    router.get("/", (req: any, res) => {
      if (req.llngSession) {
        res.json({ authenticated: true, user: req.llngSession.uid });
      } else {
        res.json({ authenticated: false, showLogin: true });
      }
    });

    router.post("/", (req: any, res) => {
      if (req.llngSession) {
        return res.json({ authenticated: true, user: req.llngSession.uid });
      }

      if (!req.llngAuthResult?.success) {
        return res.status(401).json({
          authenticated: false,
          error: req.llngAuthResult?.error,
          errorCode: req.llngAuthResult?.errorCode,
        });
      }

      // Create session
      const sessionId = Math.random().toString(36).substring(2);
      const session = {
        _session_id: sessionId,
        _utime: Date.now() / 1000,
        uid: req.llngUserData.uid,
        ...req.llngUserData.attributes,
      };
      sessionStore.set(sessionId, session);

      res.cookie("lemonldap", sessionId, { httpOnly: true });
      res.json({ authenticated: true, user: session.uid, sessionId });
    });

    router.get("/logout", (req: any, res) => {
      if (req.llngSessionId) {
        sessionStore.delete(req.llngSessionId);
      }
      res.clearCookie("lemonldap");
      res.json({ loggedOut: true });
    });

    app.use(router);
  });

  describe("GET /", () => {
    it("should return login page for unauthenticated user", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
      expect(res.body.showLogin).toBe(true);
    });

    it("should return user info for authenticated user", async () => {
      // First login
      const loginRes = await request(app)
        .post("/")
        .send({ user: "dwho", password: "dwho" });

      const cookies = loginRes.headers["set-cookie"];

      // Then access with session
      const res = await request(app).get("/").set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user).toBe("dwho");
    });
  });

  describe("POST / - Authentication", () => {
    it("should authenticate demo user dwho", async () => {
      const res = await request(app)
        .post("/")
        .send({ user: "dwho", password: "dwho" });

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user).toBe("dwho");
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("should authenticate demo user rtyler", async () => {
      const res = await request(app)
        .post("/")
        .send({ user: "rtyler", password: "rtyler" });

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
      expect(res.body.user).toBe("rtyler");
    });

    it("should reject invalid password", async () => {
      const res = await request(app)
        .post("/")
        .send({ user: "dwho", password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body.authenticated).toBe(false);
      expect(res.body.errorCode).toBe("PE_BADCREDENTIALS");
    });

    it("should reject unknown user", async () => {
      const res = await request(app)
        .post("/")
        .send({ user: "unknown", password: "whatever" });

      expect(res.status).toBe(401);
      expect(res.body.authenticated).toBe(false);
    });

    it("should maintain session across requests", async () => {
      // Login
      const loginRes = await request(app)
        .post("/")
        .send({ user: "dwho", password: "dwho" });

      const cookies = loginRes.headers["set-cookie"];

      // Access protected resource
      const protectedRes = await request(app).get("/").set("Cookie", cookies);

      expect(protectedRes.body.authenticated).toBe(true);
      expect(protectedRes.body.user).toBe("dwho");
    });
  });

  describe("GET /logout", () => {
    it("should logout and clear session", async () => {
      // First login
      const loginRes = await request(app)
        .post("/")
        .send({ user: "dwho", password: "dwho" });

      const cookies = loginRes.headers["set-cookie"];

      // Logout
      const logoutRes = await request(app)
        .get("/logout")
        .set("Cookie", cookies);

      expect(logoutRes.body.loggedOut).toBe(true);

      // Verify session is cleared
      const afterLogout = await request(app).get("/").set("Cookie", cookies);

      expect(afterLogout.body.authenticated).toBe(false);
    });
  });
});
