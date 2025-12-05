import type { Response, NextFunction } from "express";
import type { PortalRequest } from "../types";
import type { Portal } from "../portal";

/**
 * Authentication middleware
 * Extracts credentials and authenticates user
 */
export function authMiddleware(portal: Portal) {
  const authModule = portal.getAuthModule();
  const logger = portal.getLogger();

  return async (
    req: PortalRequest,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Skip if already authenticated
    if (req.llngSession) {
      return next();
    }

    // Extract credentials from request
    const credentials = authModule.extractCredentials(req);

    if (!credentials) {
      // No credentials provided, continue to show login form
      return next();
    }

    req.llngCredentials = credentials;
    logger.debug(`Authenticating user: ${credentials.user}`);

    try {
      const result = await authModule.authenticate(credentials);
      req.llngAuthResult = result;

      if (result.success) {
        logger.info(`User ${credentials.user} authenticated successfully`);
      } else {
        logger.notice(
          `Authentication failed for ${credentials.user}: ${result.error || "unknown error"}`,
        );
      }
    } catch (e) {
      logger.error(`Authentication error for ${credentials.user}: ${e}`);
      req.llngAuthResult = {
        success: false,
        error: "Authentication error",
        errorCode: "AUTH_ERROR",
      };
    }

    next();
  };
}

export default authMiddleware;
