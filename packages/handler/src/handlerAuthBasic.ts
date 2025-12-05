/**
 * AuthBasic Handler for LemonLDAP::NG
 * Port of Lemonldap::NG::Handler::Lib::AuthBasic
 *
 * This handler supports HTTP Basic Authentication by:
 * 1. Computing a deterministic session ID from credentials
 * 2. Checking if session exists
 * 3. If not, asking the portal to create it via REST API
 * 4. Sending WWW-Authenticate challenge when needed
 */

import express from "express";
import http from "http";
import crypto from "crypto";
import { LLNG_Session } from "@lemonldap-ng/types";
import LemonldapNGHandler from "./handlerMain";

interface PendingAuth {
  username: string;
  password: string;
  xff: string;
}

class LemonldapNGHandlerAuthBasic extends LemonldapNGHandler {
  // Store pending authentication data keyed by session ID
  private pendingAuth: Map<string, PendingAuth> = new Map();

  /**
   * Override fetchId to compute session ID from Basic Auth credentials
   * Session ID = sha256(base64_creds + pepper)
   * pepper = int(time / timeout) + keyH (changes daily)
   * @param req - HTTP request
   */
  fetchId(req: express.Request | http.IncomingMessage): string {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.toLowerCase().startsWith("basic ")) {
      const credentials = authHeader.substring(6).trim();

      if (credentials) {
        // Compute deterministic session ID from credentials
        // This changes daily based on timeout to limit exposure
        // pepper = int(time / timeout) + keyH (same as Perl implementation)
        const pepper =
          Math.floor(Date.now() / 1000 / this.tsv.timeout) +
          (this.tsv.keyH || "");
        const sessionId = crypto
          .createHash("sha256")
          .update(credentials + pepper)
          .digest("hex");

        // Decode and store credentials for potential session creation
        try {
          const decoded = Buffer.from(credentials, "base64").toString("utf-8");
          const colonIndex = decoded.indexOf(":");
          if (colonIndex > 0) {
            const username = decoded.substring(0, colonIndex);
            const password = decoded.substring(colonIndex + 1);

            // Build X-Forwarded-For
            const existingXff = req.headers["x-forwarded-for"];
            const clientIp =
              (req as express.Request).ip || req.socket?.remoteAddress || "";
            const xff = existingXff ? `${existingXff}, ${clientIp}` : clientIp;

            // Store for use in retrieveSession
            this.pendingAuth.set(sessionId, { username, password, xff });
          }
        } catch {
          // Ignore decode errors, will be handled in retrieveSession
        }

        this.userLogger.debug(`AuthBasic: computed session ID for credentials`);
        return sessionId;
      }
    }

    // Fall back to cookie-based authentication
    return super.fetchId(req);
  }

  /**
   * Override retrieveSession to create session via portal if needed
   * @param id - Session ID
   */
  retrieveSession(id: string): Promise<LLNG_Session> {
    return new Promise((resolve, reject) => {
      // First try to get existing session
      super
        .retrieveSession(id)
        .then((session) => {
          // Session exists, clean up pending auth
          this.pendingAuth.delete(id);
          resolve(session);
        })
        .catch(async () => {
          // Session doesn't exist, try to create it via portal
          const pending = this.pendingAuth.get(id);
          if (!pending) {
            reject("No session and no pending authentication");
            return;
          }

          // Clean up pending auth
          this.pendingAuth.delete(id);

          // Try to create session via portal
          const created = await this.createSession(
            id,
            pending.username,
            pending.password,
            pending.xff,
          );

          if (created) {
            // Session was created, now retrieve it
            super.retrieveSession(id).then(resolve).catch(reject);
          } else {
            reject("Authentication failed");
          }
        });
    });
  }

  /**
   * Create session via portal REST API
   * POST to portal/sessions/global/{id}?auth
   * @param id - Session ID to create
   * @param username - Username from Basic auth
   * @param password - Password from Basic auth
   * @param xff - X-Forwarded-For header value
   * @returns true if session created successfully
   */
  private async createSession(
    id: string,
    username: string,
    password: string,
    xff: string,
  ): Promise<boolean> {
    // Validate session ID to mitigate SSRF
    if (!/^[a-fA-F0-9]{1,64}$/.test(id)) {
      this.userLogger.error(`AuthBasic: Invalid session ID format: ${id}`);
      return false;
    }
    const portal = this.tsv.portal();
    if (!portal) {
      this.userLogger.error("AuthBasic: portal URL not configured");
      return false;
    }

    // Build URL: portal/sessions/global/{id}?auth
    let url = `${portal}/sessions/global/${id}?auth`;
    url = url.replace(/\/\/sessions\//, "/sessions/");

    // Build request body
    const bodyParams: Record<string, string> = {
      user: username,
      password: password,
      secret: this.tsv.cipher?.encrypt(Date.now().toString()) || "",
    };

    // Add auth choice if configured
    if (this.tsv.authChoiceAuthBasic) {
      const paramName = this.tsv.authChoiceParam || "lmAuth";
      bodyParams[paramName] = this.tsv.authChoiceAuthBasic;
    }

    const body = new URLSearchParams(bodyParams).toString();

    this.userLogger.debug(`AuthBasic: authenticating ${username} via portal`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "X-Forwarded-For": xff,
        },
        body: body,
      });

      if (response.ok) {
        this.userLogger.info(
          `AuthBasic: authentication successful for ${username}`,
        );
        return true;
      } else {
        this.userLogger.warn(
          `AuthBasic: authentication failed for ${username}: ${response.status} ${response.statusText}`,
        );
        return false;
      }
    } catch (e) {
      this.userLogger.error(`AuthBasic: portal request failed: ${e}`);
      return false;
    }
  }

  /**
   * Hide Authorization header from protected application
   * Called after successful authentication
   * @param req - HTTP request
   */
  hideCookie(req: express.Request | http.IncomingMessage): void {
    this.userLogger.debug("AuthBasic: removing Authorization header");
    delete req.headers.authorization;
  }

  /**
   * Override goToPortal to send Basic challenge instead of redirect
   * @param res - HTTP response
   * @param uri - Original URI
   * @param args - Additional arguments
   */
  goToPortal(res: http.ServerResponse, uri: string, args: string = ""): void {
    if (args) {
      // If there's an argument, redirect to portal with message
      super.goToPortal(res, uri, args);
    } else {
      // Otherwise, send WWW-Authenticate challenge
      res.setHeader("WWW-Authenticate", 'Basic realm="LemonLDAP::NG"');
      this.setError(res, uri, 401, "Authentication required");
    }
  }
}

export default LemonldapNGHandlerAuthBasic;
