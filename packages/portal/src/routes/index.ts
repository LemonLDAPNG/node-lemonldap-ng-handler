import { Router, Response } from "express";
import type { PortalRequest } from "../types";
import type { Portal } from "../portal";

/**
 * Create portal routes
 */
export function createRoutes(portal: Portal): Router {
  const router = Router();
  const conf = portal.getConf();
  const logger = portal.getLogger();
  const cookieName = conf.cookieName || "lemonldap";

  /**
   * GET / - Show login form or menu
   */
  router.get("/", async (req: PortalRequest, res: Response) => {
    // Already authenticated?
    if (req.llngSession) {
      const html = portal.render("menu", {
        session: req.llngSession,
        URLDC: req.llngUrldc,
      });
      return res.send(html);
    }

    // Show login form
    const html = portal.render("login", {
      URLDC: req.llngUrldc,
    });
    res.send(html);
  });

  /**
   * POST / - Process login
   */
  router.post("/", async (req: PortalRequest, res: Response) => {
    // Already authenticated?
    if (req.llngSession) {
      // Redirect to urldc or show menu
      if (req.llngUrldc) {
        return res.redirect(req.llngUrldc);
      }
      const html = portal.render("menu", {
        session: req.llngSession,
      });
      return res.send(html);
    }

    // Check auth result
    if (!req.llngAuthResult?.success) {
      // Auth failed, show login form with error
      const html = portal.render("login", {
        AUTH_ERROR: req.llngAuthResult?.error || "Authentication failed",
        AUTH_ERROR_CODE: req.llngAuthResult?.errorCode,
        LOGIN: req.llngCredentials?.user,
        URLDC: req.llngUrldc || req.body?.url,
      });
      return res.send(html);
    }

    // Auth succeeded, create session
    if (!req.llngUserData) {
      const html = portal.render("error", {
        error: "User data not found",
        errorCode: "NO_USER_DATA",
      });
      return res.status(500).send(html);
    }

    const sessionId = portal.generateSessionId();
    const userDBModule = portal.getUserDBModule();

    // Create session with user data
    const session = await portal.createSession(sessionId, {
      _user: req.llngCredentials!.user,
    });

    // Let userDB module set session info
    userDBModule.setSessionInfo(session, req.llngUserData);
    await portal.updateSession(session);

    logger.info(`Session created for ${session.uid || session._user}`);

    // Set session cookie
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: "lax" | "strict" | "none";
      path: string;
      domain?: string;
      maxAge?: number;
    } = {
      httpOnly: conf.httpOnly !== false,
      secure: conf.securedCookie === 1 || req.secure,
      sameSite: "lax",
      path: "/",
    };

    if (conf.domain) {
      cookieOptions.domain = conf.domain;
    }

    if (conf.cookieExpiration && conf.cookieExpiration > 0) {
      cookieOptions.maxAge = conf.cookieExpiration * 1000;
    }

    res.cookie(cookieName, sessionId, cookieOptions);

    // Redirect to urldc or show menu
    const urldc = req.llngUrldc || req.body?.url;
    if (urldc) {
      return res.redirect(urldc);
    }

    const html = portal.render("menu", {
      session,
    });
    res.send(html);
  });

  /**
   * GET /logout - Logout and destroy session
   */
  router.get("/logout", async (req: PortalRequest, res: Response) => {
    if (req.llngSessionId) {
      await portal.deleteSession(req.llngSessionId);
      logger.info(`Session ${req.llngSessionId} logged out`);
    }

    // Clear cookie
    res.clearCookie(cookieName, {
      path: "/",
      domain: conf.domain,
    });

    // Show login form
    const html = portal.render("login", {});
    res.send(html);
  });

  return router;
}

export default createRoutes;
