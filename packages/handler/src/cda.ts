/**
 * CDA (Cross-Domain Authentication) utilities for LemonLDAP::NG
 * Port of Lemonldap::NG::Handler::Main::CDA
 *
 * CDA allows authentication to be shared across different domains
 * by using encrypted cookies or URL parameters.
 */

import Crypto from "@lemonldap-ng/crypto";

/**
 * Maximum allowed clock skew in seconds for timestamp validation
 */
const MAX_CLOCK_SKEW_SECONDS = 10;

/**
 * CDA cookie value structure
 */
export interface CDAValue {
  sessionId: string;
  timestamp: number;
  domain?: string;
}

/**
 * Create a CDA cookie value
 * @param cipher - Crypto instance for encryption
 * @param sessionId - Session ID to encode
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns Encrypted CDA cookie value
 */
export function createCDACookie(
  cipher: Crypto,
  sessionId: string,
  timestamp?: number
): string {
  const ts = timestamp || Math.floor(Date.now() / 1000);
  const value = `${sessionId}:${ts}`;
  return cipher.encrypt(value);
}

/**
 * Parse and validate a CDA cookie value
 * @param cipher - Crypto instance for decryption
 * @param cookieValue - Encrypted cookie value
 * @param maxAge - Maximum age in seconds (default: 120)
 * @returns Parsed CDA value or null if invalid
 */
export function parseCDACookie(
  cipher: Crypto,
  cookieValue: string,
  maxAge: number = 120
): CDAValue | null {
  try {
    const decrypted = cipher.decrypt(cookieValue);
    const parts = decrypted.split(":");

    if (parts.length < 2) {
      return null;
    }

    const sessionId = parts[0];
    const timestamp = parseInt(parts[1], 10);

    if (!sessionId || isNaN(timestamp)) {
      return null;
    }

    // Check timestamp validity
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > maxAge || timestamp > now + MAX_CLOCK_SKEW_SECONDS) {
      // Cookie too old or too far in the future (clock skew)
      return null;
    }

    return {
      sessionId,
      timestamp,
      domain: parts[2],
    };
  } catch {
    return null;
  }
}

/**
 * Generate CDA URL parameter
 * @param cipher - Crypto instance
 * @param sessionId - Session ID
 * @param url - Target URL
 * @returns URL with CDA parameter
 */
export function appendCDAParam(
  cipher: Crypto,
  sessionId: string,
  url: string
): string {
  const cdaValue = createCDACookie(cipher, sessionId);
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}lemonldapcda=${encodeURIComponent(cdaValue)}`;
}

/**
 * Extract CDA value from URL
 * @param url - URL potentially containing CDA parameter
 * @returns CDA parameter value or null
 */
export function extractCDAFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url, "http://localhost");
    return urlObj.searchParams.get("lemonldapcda");
  } catch {
    return null;
  }
}

/**
 * Build Set-Cookie header for CDA
 * @param cookieName - Cookie name
 * @param value - Cookie value
 * @param domain - Cookie domain
 * @param expiration - Expiration in seconds (0 for session cookie)
 * @param secure - Whether to set Secure flag
 * @param httpOnly - Whether to set HttpOnly flag
 * @returns Cookie header string
 */
export function buildCDACookieHeader(
  cookieName: string,
  value: string,
  domain: string,
  expiration: number = 0,
  secure: boolean = false,
  httpOnly: boolean = true
): string {
  let cookie = `${cookieName}=${value}`;

  if (domain) {
    cookie += `; Domain=${domain}`;
  }

  cookie += "; Path=/";

  if (expiration > 0) {
    const expires = new Date(Date.now() + expiration * 1000);
    cookie += `; Expires=${expires.toUTCString()}`;
  }

  if (secure) {
    cookie += "; Secure";
  }

  if (httpOnly) {
    cookie += "; HttpOnly";
  }

  cookie += "; SameSite=None";

  return cookie;
}

/**
 * Delete CDA cookie header
 * @param cookieName - Cookie name
 * @param domain - Cookie domain
 * @returns Cookie header string that expires the cookie
 */
export function deleteCDACookieHeader(
  cookieName: string,
  domain: string
): string {
  let cookie = `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;

  if (domain) {
    cookie += `; Domain=${domain}`;
  }

  return cookie;
}
