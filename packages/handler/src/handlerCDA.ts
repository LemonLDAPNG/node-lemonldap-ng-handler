/**
 * CDA (Cross-Domain Authentication) Handler for LemonLDAP::NG
 * Port of Lemonldap::NG::Handler::Main with CDA support
 *
 * This handler enables cross-domain authentication by:
 * 1. Checking for CDA cookies/parameters on incoming requests
 * 2. Setting CDA cookies when users authenticate
 * 3. Propagating authentication across configured domains
 */

import express from "express";
import http from "http";
import LemonldapNGHandler from "./handlerMain";
import {
  parseCDACookie,
  buildCDACookieHeader,
  extractCDAFromUrl,
} from "./cda";

class LemonldapNGHandlerCDA extends LemonldapNGHandler {
  /**
   * Override fetchId to check for CDA cookie/parameter first
   * @param req - HTTP request
   */
  fetchId(req: express.Request | http.IncomingMessage): string {
    // Check if CDA is enabled
    if (!this.tsv.cda) {
      return super.fetchId(req);
    }

    // 1. Check for CDA URL parameter (from redirect)
    const url = req.url || "/";
    const cdaParam = extractCDAFromUrl(url);

    if (cdaParam) {
      const cdaValue = parseCDACookie(this.tsv.cipher, cdaParam);
      if (cdaValue) {
        this.userLogger.debug(`CDA: extracted session from URL parameter`);
        // Set the CDA cookie for future requests
        this.setCDACookie(req, cdaValue.sessionId);
        return cdaValue.sessionId;
      } else {
        this.userLogger.warn("CDA: invalid or expired URL parameter");
      }
    }

    // 2. Check for CDA cookie
    const cdaCookieName = `${this.tsv.cookieName}cda`;
    const cdaCookie = this.getCDACookie(req, cdaCookieName);

    if (cdaCookie) {
      const cdaValue = parseCDACookie(this.tsv.cipher, cdaCookie);
      if (cdaValue) {
        this.userLogger.debug(`CDA: extracted session from cookie`);
        return cdaValue.sessionId;
      } else {
        this.userLogger.warn("CDA: invalid or expired cookie");
      }
    }

    // 3. Fall back to standard cookie
    return super.fetchId(req);
  }

  /**
   * Get CDA cookie value from request
   * @param req - HTTP request
   * @param cookieName - Cookie name to look for
   */
  private getCDACookie(
    req: express.Request | http.IncomingMessage,
    cookieName: string
  ): string | null {
    const cookies = req.headers.cookie;
    if (!cookies) {
      return null;
    }

    const regex = new RegExp(`${cookieName}=([^;]+)`);
    const match = regex.exec(cookies);
    return match ? match[1] : null;
  }

  /**
   * Set CDA cookie on response (placeholder for middleware integration)
   *
   * TODO: Implement full CDA cookie setting mechanism. Options include:
   * 1. Store the value in req.llngCdaInfo and set in sendHeaders via response
   * 2. Use express middleware to intercept and set the cookie
   * 3. Pass response object through the call chain
   *
   * Currently a no-op as we don't have access to the response object here.
   *
   * @param _req - HTTP request (unused)
   * @param _sessionId - Session ID to set (unused)
   */
  private setCDACookie(
    _req: express.Request | http.IncomingMessage,
    _sessionId: string
  ): void {
    // Placeholder - see TODO in JSDoc above
  }

  /**
   * Override sendHeaders to also set CDA cookie
   * @param req - HTTP request
   * @param session - User session
   */
  sendHeaders(
    req: express.Request | http.IncomingMessage,
    session: import("@lemonldap-ng/types").LLNG_Session
  ): void {
    super.sendHeaders(req, session);

    // If CDA is enabled, prepare CDA cookie header
    // Store in a custom property for middleware to process
    if (this.tsv.cda) {
      const cdaCookieName = `${this.tsv.cookieName}cda`;
      const domain = this.getCDACookieDomain(req);

      if (domain) {
        // Store CDA cookie info as a custom property on the request object
        // Middleware can read this and set the cookie on the response
        (req as any).llngCdaCookie = buildCDACookieHeader(
          cdaCookieName,
          session._session_id,
          domain,
          this.tsv.cookieExpiration || 0,
          this.tsv.securedCookie > 0,
          this.tsv.httpOnly
        );
      }
    }
  }

  /**
   * Get domain for CDA cookie
   * @param req - HTTP request
   */
  private getCDACookieDomain(
    req: express.Request | http.IncomingMessage
  ): string {
    const host = req.headers.host;
    if (!host) {
      return "";
    }

    // Extract domain from host (remove port)
    const hostname = host.split(":")[0];

    // For CDA, we typically want to set the cookie on a parent domain
    // This is a simplified implementation - full implementation would
    // use configured CDA domains
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      // Return parent domain (e.g., .example.com from www.example.com)
      return "." + parts.slice(-2).join(".");
    }

    return hostname;
  }

  /**
   * Override goToPortal to include CDA parameter
   * @param res - HTTP response
   * @param uri - Original URI
   * @param args - Additional arguments
   */
  goToPortal(res: http.ServerResponse, uri: string, args: string = ""): void {
    // Add CDA parameter if enabled
    if (this.tsv.cda) {
      const cdaArg = "cda=1";
      args = args ? `${args}&${cdaArg}` : cdaArg;
    }

    super.goToPortal(res, uri, args);
  }
}

export default LemonldapNGHandlerCDA;
