/**
 * SAML Utilities
 *
 * Helper functions for SAML message encoding/decoding,
 * NameID format conversion, and binding detection.
 */

import { HttpMethod, NameIdFormat, SignatureMethod } from "lasso.js";
import type {
  SAMLBinding,
  SAMLNameIDFormatType,
  SAMLSignatureMethod,
} from "./types";

/**
 * Convert SAML binding string to HttpMethod enum
 */
export function bindingToHttpMethod(binding: SAMLBinding): HttpMethod {
  switch (binding) {
    case "http-redirect":
      return HttpMethod.REDIRECT;
    case "http-post":
      return HttpMethod.POST;
    case "http-soap":
      return HttpMethod.SOAP;
    case "http-artifact":
      return HttpMethod.ARTIFACT_POST;
    default:
      return HttpMethod.REDIRECT;
  }
}

/**
 * Convert HttpMethod enum to SAML binding string
 */
export function httpMethodToBinding(method: HttpMethod): SAMLBinding {
  switch (method) {
    case HttpMethod.REDIRECT:
      return "http-redirect";
    case HttpMethod.POST:
      return "http-post";
    case HttpMethod.SOAP:
      return "http-soap";
    case HttpMethod.ARTIFACT_GET:
    case HttpMethod.ARTIFACT_POST:
      return "http-artifact";
    default:
      return "http-redirect";
  }
}

/**
 * Convert NameID format string to URN
 */
export function nameIdFormatToUrn(format: SAMLNameIDFormatType): string {
  switch (format) {
    case "email":
      return NameIdFormat.EMAIL;
    case "persistent":
      return NameIdFormat.PERSISTENT;
    case "transient":
      return NameIdFormat.TRANSIENT;
    case "encrypted":
      return NameIdFormat.ENCRYPTED;
    case "kerberos":
      return NameIdFormat.KERBEROS;
    case "unspecified":
    default:
      return NameIdFormat.UNSPECIFIED;
  }
}

/**
 * Convert NameID URN to format string
 */
export function urnToNameIdFormat(urn: string): SAMLNameIDFormatType {
  switch (urn) {
    case NameIdFormat.EMAIL:
      return "email";
    case NameIdFormat.PERSISTENT:
      return "persistent";
    case NameIdFormat.TRANSIENT:
      return "transient";
    case NameIdFormat.ENCRYPTED:
      return "encrypted";
    case NameIdFormat.KERBEROS:
      return "kerberos";
    case NameIdFormat.UNSPECIFIED:
    default:
      return "unspecified";
  }
}

/**
 * Convert signature method string to enum
 */
export function signatureMethodToEnum(
  method: SAMLSignatureMethod,
): SignatureMethod {
  switch (method) {
    case "RSA_SHA1":
      return SignatureMethod.RSA_SHA1;
    case "RSA_SHA256":
      return SignatureMethod.RSA_SHA256;
    case "RSA_SHA384":
      return SignatureMethod.RSA_SHA384;
    case "RSA_SHA512":
      return SignatureMethod.RSA_SHA512;
    default:
      return SignatureMethod.RSA_SHA256;
  }
}

/**
 * Detect HTTP method from request
 */
export function detectHttpMethod(req: {
  method?: string;
  body?: unknown;
  query?: unknown;
}): HttpMethod {
  if (req.method === "POST") {
    return HttpMethod.POST;
  }
  return HttpMethod.REDIRECT;
}

/**
 * Extract SAML message from request
 * @param req - HTTP request object
 * @returns Object with samlRequest/samlResponse and relayState
 */
export function extractSamlMessage(req: {
  method?: string;
  body?: Record<string, string>;
  query?: Record<string, string>;
}): {
  message: string | null;
  isRequest: boolean;
  relayState: string | null;
  method: HttpMethod;
} {
  const method = detectHttpMethod(req);
  const params = method === HttpMethod.POST ? req.body : req.query;

  if (!params) {
    return { message: null, isRequest: false, relayState: null, method };
  }

  const samlRequest = params.SAMLRequest || params.samlRequest;
  const samlResponse = params.SAMLResponse || params.samlResponse;
  const relayState = params.RelayState || params.relayState || null;

  if (samlRequest) {
    return {
      message: samlRequest,
      isRequest: true,
      relayState,
      method,
    };
  }

  if (samlResponse) {
    return {
      message: samlResponse,
      isRequest: false,
      relayState,
      method,
    };
  }

  return { message: null, isRequest: false, relayState, method };
}

/**
 * Decode SAML message (handles deflate for Redirect binding)
 * Note: For Redirect binding, lasso.js handles deflate internally
 */
export function decodeSamlMessage(
  message: string,
  _method: HttpMethod,
): string {
  // lasso.js handles decoding internally, so we just return as-is
  // For POST binding, message is base64 encoded
  // For Redirect binding, message is deflated + base64 + URL encoded
  return message;
}

/**
 * Generate a unique ID for SAML messages
 */
export function generateSamlId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for older Node.js
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return (
    "_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

/**
 * Generate ISO 8601 timestamp
 */
export function generateIsoTimestamp(date?: Date): string {
  return (date || new Date()).toISOString();
}

/**
 * Parse ISO 8601 timestamp
 */
export function parseIsoTimestamp(timestamp: string): Date {
  return new Date(timestamp);
}

/**
 * Check if a timestamp is still valid (not expired)
 * @param timestamp - ISO timestamp to check
 * @param allowedSkew - Allowed clock skew in seconds (default 60)
 */
export function isTimestampValid(timestamp: string, allowedSkew = 60): boolean {
  const time = parseIsoTimestamp(timestamp);
  const now = new Date();
  const diff = Math.abs(now.getTime() - time.getTime()) / 1000;
  return diff <= allowedSkew;
}

/**
 * Build HTML form for POST binding
 */
export function buildPostForm(
  action: string,
  params: Record<string, string>,
): string {
  const inputs = Object.entries(params)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}"/>`,
    )
    .join("\n      ");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SAML POST</title>
</head>
<body onload="document.forms[0].submit()">
  <noscript>
    <p>JavaScript is disabled. Click the button below to continue.</p>
  </noscript>
  <form method="POST" action="${escapeHtml(action)}">
    ${inputs}
    <noscript>
      <button type="submit">Continue</button>
    </noscript>
  </form>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape XML special characters
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build URL with query parameters
 */
export function buildUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Parse query string
 */
export function parseQueryString(query: string): Record<string, string> {
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(query);
  for (const [key, value] of searchParams) {
    params[key] = value;
  }
  return params;
}
