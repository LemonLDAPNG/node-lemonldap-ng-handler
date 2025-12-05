/**
 * OAuth2/OIDC Handler for LemonLDAP::NG
 * Port of Lemonldap::NG::Handler::OAuth2
 *
 * This handler validates OAuth2/OIDC access tokens and retrieves
 * the associated session from the OIDC session storage.
 */

import express from "express";
import http from "http";
import LemonldapNGHandler from "./handlerMain";
import Session from "@lemonldap-ng/session";
import { getAccessTokenSessionId } from "@lemonldap-ng/jwt";
import { LLNG_Session } from "@lemonldap-ng/types";

class LemonldapNGHandlerOAuth2 extends LemonldapNGHandler {
  private oidcSessionAcc: Session | undefined;

  /**
   * Override init to also initialize OIDC session storage
   */
  init() {
    return new Promise<boolean>((resolve, reject) => {
      super
        .init()
        .then(() => {
          // Initialize OIDC session storage if configured
          if (this.tsv.oidcStorageModule) {
            try {
              this.oidcSessionAcc = new Session({
                storageModule: this.tsv.oidcStorageModule,
                storageModuleOptions: this.tsv.oidcStorageOptions || {},
              });
              this.oidcSessionAcc.ready
                .then(() => {
                  this.userLogger.debug(
                    "OAuth2 OIDC session storage initialized",
                  );
                  resolve(true);
                })
                .catch((e) => {
                  this.userLogger.error(
                    `Failed to initialize OIDC session storage: ${e}`,
                  );
                  reject(e);
                });
            } catch (e) {
              this.userLogger.error(
                `Failed to create OIDC session accessor: ${e}`,
              );
              reject(e);
            }
          } else {
            // Use default session storage for OIDC tokens
            this.userLogger.debug(
              "OAuth2 handler using default session storage for OIDC",
            );
            resolve(true);
          }
        })
        .catch(reject);
    });
  }

  /**
   * Override fetchId to check for OAuth2 Bearer token
   * @param req - HTTP request
   */
  fetchId(req: express.Request | http.IncomingMessage): string {
    // Check for Authorization header with Bearer token
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const accessToken = authHeader.substring(7).trim();

      if (accessToken) {
        // Try to extract session ID from the access token
        const sessionId = getAccessTokenSessionId(accessToken);

        if (sessionId) {
          this.userLogger.debug(`OAuth2: extracted session ID from token`);
          return sessionId;
        } else {
          this.userLogger.warn(
            "OAuth2: could not extract session ID from token",
          );
          return "";
        }
      }
    }

    // Fall back to cookie-based authentication
    return super.fetchId(req);
  }

  /**
   * Override retrieveSession to use OIDC session storage if token-based
   * @param id - Session ID
   */
  retrieveSession(id: string): Promise<LLNG_Session> {
    // Check if we should use OIDC session storage
    // For now, use the same logic as parent class
    // The OIDC sessions are typically in the same format
    if (this.oidcSessionAcc) {
      return new Promise<LLNG_Session>((resolve, reject) => {
        // @ts-ignore: oidcSessionAcc is defined
        this.oidcSessionAcc
          .get(id)
          .then((session: LLNG_Session) => {
            const now = (Date.now() / 1000) | 0;
            if (
              now - session._utime > this.tsv.timeout ||
              (this.tsv.timeoutActivity &&
                session._lastSeen &&
                // @ts-ignore: session._lastSeen is defined
                now - session._lastSeen > this.tsv.timeoutActivity)
            ) {
              reject(`OAuth2 session ${id} expired`);
            } else {
              resolve(session);
            }
          })
          .catch((_e: string) => {
            // If not found in OIDC storage, try main storage
            super.retrieveSession(id).then(resolve).catch(reject);
          });
      });
    }
    return super.retrieveSession(id);
  }
}

export default LemonldapNGHandlerOAuth2;
