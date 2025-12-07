/**
 * SAML Issuer Router
 *
 * Express router for SAML IdP endpoints.
 */

import type { Router, Request, Response, NextFunction } from "express";
import { SAMLIssuer } from "./issuer";
import type { SAMLIssuerConfig, SSOContext } from "./types";

/**
 * Extended request with SAML context
 */
export interface SAMLRequest extends Request {
  samlContext?: SSOContext;
  samlSessionId?: string;
  samlSession?: Record<string, unknown>;
}

/**
 * Create SAML Issuer router
 */
export function createSAMLIssuerRouter(
  issuer: SAMLIssuer,
  config: SAMLIssuerConfig & {
    /** Middleware to check if user is authenticated */
    requireAuth?: (req: SAMLRequest, res: Response, next: NextFunction) => void;
    /** Get session ID from request */
    getSessionId?: (req: SAMLRequest) => string | null;
    /** Get session data from session ID */
    getSessionData?: (
      sessionId: string,
    ) => Promise<Record<string, unknown> | null>;
  },
): Router {
  // Dynamic import of express Router
  const express = require("express");
  const router: Router = express.Router();

  // Ensure body parsing middleware is available
  router.use(express.urlencoded({ extended: true }));

  /**
   * GET /metadata - IdP Metadata
   */
  router.get("/metadata", (_req: Request, res: Response) => {
    try {
      const metadata = issuer.getMetadata();
      res.set("Content-Type", "application/samlmetadata+xml");
      res.send(metadata);
    } catch {
      res.status(500).send("Error generating metadata");
    }
  });

  /**
   * GET/POST /singleSignOn - SSO endpoint
   */
  router.all(
    "/singleSignOn",
    async (req: SAMLRequest, res: Response, next: NextFunction) => {
      try {
        // Process AuthnRequest
        const context = await issuer.processAuthnRequest({
          method: req.method,
          body: req.body,
          query: req.query as Record<string, string>,
        });

        // Store context in request for auth middleware
        req.samlContext = context;

        // Check if user is authenticated
        const sessionId = config.getSessionId?.(req);

        if (sessionId) {
          const session = await config.getSessionData?.(sessionId);

          if (session) {
            // User is authenticated, build response
            req.samlSessionId = sessionId;
            req.samlSession = session;

            const response = await issuer.buildSAMLResponse(
              context,
              session,
              sessionId,
            );

            if (response.method === "POST" && response.body) {
              res.set("Content-Type", response.contentType || "text/html");
              res.send(response.body);
            } else {
              res.redirect(response.url);
            }
            return;
          }
        }

        // User not authenticated, need to authenticate
        // Store context for after authentication
        if (config.requireAuth) {
          config.requireAuth(req, res, next);
        } else {
          res.status(401).send("Authentication required");
        }
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET/POST /singleLogout - SLO endpoint (HTTP-Redirect/POST)
   */
  router.all(
    "/singleLogout",
    async (req: SAMLRequest, res: Response, next: NextFunction) => {
      try {
        const context = await issuer.processLogoutRequest({
          method: req.method,
          body: req.body,
          query: req.query as Record<string, string>,
        });

        if (context.isRequest) {
          // Process logout request
          const response = await issuer.buildLogoutResponse(context);

          if (response.method === "POST" && response.body) {
            res.set("Content-Type", response.contentType || "text/html");
            res.send(response.body);
          } else {
            res.redirect(response.url);
          }
        } else {
          // Process logout response
          // Notify next provider if any
          const sessionId = config.getSessionId?.(req);
          if (sessionId) {
            const nextLogout = await issuer.initiateLogout(sessionId);
            if (nextLogout) {
              if (nextLogout.method === "POST" && nextLogout.body) {
                res.set("Content-Type", nextLogout.contentType || "text/html");
                res.send(nextLogout.body);
              } else {
                res.redirect(nextLogout.url);
              }
              return;
            }
          }

          // All providers notified, redirect to portal
          res.redirect(config.portal);
        }
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /singleLogoutSOAP - SLO endpoint (SOAP)
   */
  router.post(
    "/singleLogoutSOAP",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // SOAP binding handling
        const soapBody = req.body;

        // Extract SAML message from SOAP envelope
        // This is a simplified implementation
        const context = await issuer.processLogoutRequest({
          method: "POST",
          body: { SAMLRequest: soapBody },
        });

        const response = await issuer.buildLogoutResponse(context);

        // Wrap response in SOAP envelope
        const soapResponse = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${response.formData?.SAMLResponse || ""}
  </soap:Body>
</soap:Envelope>`;

        res.set("Content-Type", "text/xml");
        res.send(soapResponse);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export default createSAMLIssuerRouter;
