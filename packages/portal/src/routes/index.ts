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
        HAS_PASSWORD_MODULE: portal.hasPasswordModule(),
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
        HAS_PASSWORD_MODULE: portal.hasPasswordModule(),
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
      HAS_PASSWORD_MODULE: portal.hasPasswordModule(),
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

  // Password change routes (only if password module is configured)
  if (portal.hasPasswordModule()) {
    /**
     * GET /password - Show password change form
     */
    router.get("/password", async (req: PortalRequest, res: Response) => {
      // Must be authenticated
      if (!req.llngSession) {
        return res.redirect(conf.portal || "/");
      }

      const html = portal.render("password", {
        session: req.llngSession,
      });
      res.send(html);
    });

    /**
     * POST /password - Process password change
     */
    router.post("/password", async (req: PortalRequest, res: Response) => {
      // Must be authenticated
      if (!req.llngSession) {
        return res.redirect(conf.portal || "/");
      }

      const { oldPassword, newPassword, confirmPassword } = req.body;

      // Validate form data
      if (!newPassword) {
        const html = portal.render("password", {
          session: req.llngSession,
          PASSWORD_ERROR: "New password is required",
          PASSWORD_ERROR_CODE: "PE_PASSWORD_MISSING",
        });
        return res.send(html);
      }

      if (newPassword !== confirmPassword) {
        const html = portal.render("password", {
          session: req.llngSession,
          PASSWORD_ERROR: "Passwords do not match",
          PASSWORD_ERROR_CODE: "PE_PASSWORD_MISMATCH",
        });
        return res.send(html);
      }

      // Get user DN from session
      const userDn = req.llngSession._dn as string | undefined;
      if (!userDn) {
        logger.error("Password change: No DN in session");
        const html = portal.render("password", {
          session: req.llngSession,
          PASSWORD_ERROR: "Unable to change password: user DN not found",
          PASSWORD_ERROR_CODE: "PE_ERROR",
        });
        return res.send(html);
      }

      // Check if we're in password reset mode (ppolicy mustChange)
      const passwordReset = req.llngSession._pwdMustChange === true;

      // Call password module
      const passwordModule = portal.getPasswordModule()!;
      const result = await passwordModule.modifyPassword(userDn, newPassword, {
        oldPassword,
        passwordReset,
      });

      if (!result.success) {
        logger.warn(
          `Password change failed for ${userDn}: ${result.error} (${result.errorCode})`,
        );
        const html = portal.render("password", {
          session: req.llngSession,
          PASSWORD_ERROR: result.error || "Password change failed",
          PASSWORD_ERROR_CODE: result.errorCode,
        });
        return res.send(html);
      }

      // Password changed successfully
      logger.info(`Password changed for ${userDn}`);

      // Clear mustChange flag in session
      if (req.llngSession._pwdMustChange) {
        delete req.llngSession._pwdMustChange;
        await portal.updateSession(req.llngSession);
      }

      // Show success message
      const html = portal.render("password", {
        session: req.llngSession,
        PASSWORD_SUCCESS: true,
        PASSWORD_MESSAGE: "Password changed successfully",
      });
      res.send(html);
    });
  }

  return router;
}

export default createRoutes;
