import type { Response, NextFunction } from "express";
import type { PortalRequest } from "../types";
import type { Portal } from "../portal";

/**
 * UserDB middleware
 * Fetches user data and sets session info after successful auth
 */
export function userDBMiddleware(portal: Portal) {
  const userDBModule = portal.getUserDBModule();
  const logger = portal.getLogger();

  return async (
    req: PortalRequest,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Skip if already has session or auth failed
    if (req.llngSession || !req.llngAuthResult?.success) {
      return next();
    }

    const username = req.llngAuthResult.user || req.llngCredentials?.user;
    if (!username) {
      return next();
    }

    try {
      const userData = await userDBModule.getUser(username);

      if (!userData) {
        logger.notice(`User ${username} not found in userDB`);
        req.llngAuthResult = {
          success: false,
          error: "User not found",
          errorCode: "USER_NOT_FOUND",
        };
        return next();
      }

      req.llngUserData = userData;
      logger.debug(`User data loaded for ${username}`);
    } catch (e) {
      logger.error(`UserDB error for ${username}: ${e}`);
      req.llngAuthResult = {
        success: false,
        error: "User database error",
        errorCode: "USERDB_ERROR",
      };
    }

    next();
  };
}

export default userDBMiddleware;
