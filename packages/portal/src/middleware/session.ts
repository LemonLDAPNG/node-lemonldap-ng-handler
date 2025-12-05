import type { Response, NextFunction } from "express";
import type { PortalRequest } from "../types";
import type { Portal } from "../portal";

/**
 * Session middleware
 * Extracts session ID from cookie and loads session if exists
 */
export function sessionMiddleware(portal: Portal) {
  const conf = portal.getConf();
  const cookieName = conf.cookieName || "lemonldap";
  const logger = portal.getLogger();

  return async (
    req: PortalRequest,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Extract session ID from cookie
    const sessionId = req.cookies?.[cookieName];

    if (sessionId) {
      try {
        const session = await portal.getSession(sessionId);
        if (session) {
          req.llngSession = session;
          req.llngSessionId = sessionId;
          logger.debug(
            `Session ${sessionId} loaded for ${session.uid || session._user}`,
          );
        }
      } catch (e) {
        logger.debug(`Failed to load session ${sessionId}: ${e}`);
      }
    }

    // Extract urldc from query
    if (req.query?.url) {
      req.llngUrldc = req.query.url as string;
    }

    // Set portal URL
    req.llngPortal = conf.portal || `${req.protocol}://${req.get("host")}`;

    next();
  };
}

export default sessionMiddleware;
