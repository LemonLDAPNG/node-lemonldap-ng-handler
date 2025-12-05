import express, { Router } from "express";
import cookieParser from "cookie-parser";
import { Portal } from "./portal";
import {
  sessionMiddleware,
  authMiddleware,
  userDBMiddleware,
} from "./middleware";
import { createRoutes } from "./routes";
import type { PortalOptions } from "./types";

export { Portal } from "./portal";
export { TemplateEngine } from "./templates/engine";
export * from "./types";
export * from "./middleware";
export { createRoutes } from "./routes";

let currentPortal: Portal | null = null;

/**
 * Initialize the portal
 */
export async function init(options: PortalOptions = {}): Promise<Portal> {
  currentPortal = new Portal(options);
  await currentPortal.ready;
  return currentPortal;
}

/**
 * Get the current portal instance
 */
export function getPortal(): Portal {
  if (!currentPortal) {
    throw new Error("Portal not initialized. Call init() first.");
  }
  return currentPortal;
}

/**
 * Create Express middleware for the portal
 * Includes cookie-parser, session, auth, userdb middlewares and routes
 */
export function middleware(portal?: Portal): Router {
  const p = portal || currentPortal;
  if (!p) {
    throw new Error(
      "Portal not initialized. Call init() first or pass portal instance.",
    );
  }

  const router = Router();

  // Parse cookies
  router.use(cookieParser());

  // Parse body
  router.use(express.urlencoded({ extended: true }));
  router.use(express.json());

  // Portal middlewares
  router.use(sessionMiddleware(p));
  router.use(authMiddleware(p));
  router.use(userDBMiddleware(p));

  // Portal routes
  router.use(createRoutes(p));

  return router;
}

/**
 * Create a standalone Express app for the portal
 */
export function createApp(portal?: Portal): express.Application {
  const app = express();
  app.use(middleware(portal));
  return app;
}

export default { init, getPortal, middleware, createApp, Portal };
