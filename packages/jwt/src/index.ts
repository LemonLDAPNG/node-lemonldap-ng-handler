/**
 * JWT utilities for LemonLDAP::NG
 * Port of Lemonldap::NG::Common::JWT
 */

/**
 * Decode a base64url encoded string
 * @param str - Base64url encoded string
 * @returns Decoded string
 */
export function decodeBase64Url(str: string): string {
  // Replace URL-safe characters with standard base64 characters
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if necessary
  while (base64.length % 4) {
    base64 += "=";
  }

  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Get a specific part of a JWT (header, payload, or signature)
 * @param jwt - JWT in serialized form
 * @param part - 0 for header, 1 for payload, 2 for signature
 * @returns Decoded JSON object or null if invalid
 */
export function getJWTPart(
  jwt: string,
  part: number
): Record<string, any> | null {
  const jwtParts = jwt.split(".");

  if (jwtParts.length < 2) {
    return null;
  }

  if (part >= jwtParts.length) {
    return null;
  }

  try {
    const decoded = decodeBase64Url(jwtParts[part]);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Get the decoded JWT header
 * @param jwt - JWT in serialized form
 * @returns Decoded header object or null if invalid
 */
export function getJWTHeader(jwt: string): Record<string, any> | null {
  return getJWTPart(jwt, 0);
}

/**
 * Get the decoded JWT payload
 * @param jwt - JWT in serialized form
 * @returns Decoded payload object or null if invalid
 */
export function getJWTPayload(jwt: string): Record<string, any> | null {
  return getJWTPart(jwt, 1);
}

/**
 * Get the JWT signature (raw base64url encoded)
 * @param jwt - JWT in serialized form
 * @returns Signature string or null if invalid
 */
export function getJWTSignature(jwt: string): string | null {
  const jwtParts = jwt.split(".");

  if (jwtParts.length < 3) {
    return null;
  }

  return jwtParts[2];
}

/**
 * Get the JWT signed data (header.payload)
 * @param jwt - JWT in serialized form
 * @returns Signed data string or null if invalid
 */
export function getJWTSignedData(jwt: string): string | null {
  const jwtParts = jwt.split(".");

  if (jwtParts.length < 2) {
    return null;
  }

  return `${jwtParts[0]}.${jwtParts[1]}`;
}

/**
 * Extracts the session ID from an access token.
 * If the token is a JWT, extracts the `jti` field; otherwise, treats the token as a raw session ID.
 * @param accessToken - Access token (JWT or raw session ID)
 * @returns Session ID or null if not found
 */
export function getAccessTokenSessionId(accessToken: string): string | null {
  // Access Token is a JWT, extract the JTI field and use it as session ID
  if (accessToken.indexOf(".") > 0) {
    const payload = getJWTPayload(accessToken);

    if (payload && payload.jti) {
      return payload.jti;
    }

    return null;
  }

  // Access Token is the session ID directly
  return accessToken;
}

export default {
  decodeBase64Url,
  getJWTPart,
  getJWTHeader,
  getJWTPayload,
  getJWTSignature,
  getJWTSignedData,
  getAccessTokenSessionId,
};
