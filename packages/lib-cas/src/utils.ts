/**
 * CAS utility functions
 */

/**
 * Check if a service URL matches an allowed pattern
 * Patterns can include wildcards (*) and regex-like matching
 */
export function isServiceUrlValid(
  serviceUrl: string,
  allowedPatterns: string[],
): boolean {
  if (!serviceUrl || !allowedPatterns || allowedPatterns.length === 0) {
    return false;
  }

  for (const pattern of allowedPatterns) {
    if (matchServicePattern(serviceUrl, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Match a service URL against a pattern
 * Supports:
 * - Exact match
 * - Wildcard (*) in host and path
 * - Prefix match (pattern without trailing /)
 */
function matchServicePattern(url: string, pattern: string): boolean {
  // Exact match
  if (url === pattern) {
    return true;
  }

  // If pattern has wildcards, convert to regex
  if (pattern.includes("*")) {
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape regex special chars except *
      .replace(/\*/g, ".*"); // Convert * to .*
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  }

  // Prefix match: pattern matches if URL starts with pattern
  // e.g., pattern "http://app.example.com" matches "http://app.example.com/path"
  if (url.startsWith(pattern)) {
    // Ensure we match at a path boundary
    const remainder = url.slice(pattern.length);
    if (
      remainder === "" ||
      remainder.startsWith("/") ||
      remainder.startsWith("?")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extract the service URL from a full URL with ticket
 * Removes the 'ticket' query parameter
 */
export function extractServiceUrl(fullUrl: string): string {
  try {
    const url = new URL(fullUrl);
    url.searchParams.delete("ticket");
    return url.toString();
  } catch {
    // If URL parsing fails, try simple string manipulation
    return fullUrl
      .replace(/([?&])ticket=[^&]*(&|$)/, "$1")
      .replace(/[?&]$/, "");
  }
}

/**
 * Append query parameter to URL
 */
export function appendQueryParam(
  url: string,
  key: string,
  value: string,
): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

/**
 * Build CAS login URL
 */
export function buildCasLoginUrl(
  casServerUrl: string,
  serviceUrl: string,
  options?: {
    renew?: boolean;
    gateway?: boolean;
  },
): string {
  let url = `${casServerUrl}/login?service=${encodeURIComponent(serviceUrl)}`;

  if (options?.renew) {
    url += "&renew=true";
  }
  if (options?.gateway) {
    url += "&gateway=true";
  }

  return url;
}

/**
 * Build CAS logout URL
 */
export function buildCasLogoutUrl(
  casServerUrl: string,
  serviceUrl?: string,
): string {
  let url = `${casServerUrl}/logout`;

  if (serviceUrl) {
    url += `?service=${encodeURIComponent(serviceUrl)}`;
  }

  return url;
}

/**
 * Build CAS validate URL (CAS 1.0)
 */
export function buildValidateUrl(
  casServerUrl: string,
  serviceUrl: string,
  ticket: string,
): string {
  return `${casServerUrl}/validate?service=${encodeURIComponent(serviceUrl)}&ticket=${encodeURIComponent(ticket)}`;
}

/**
 * Build CAS serviceValidate URL (CAS 2.0/3.0)
 */
export function buildServiceValidateUrl(
  casServerUrl: string,
  serviceUrl: string,
  ticket: string,
  options?: {
    pgtUrl?: string;
    renew?: boolean;
    format?: "XML" | "JSON";
    p3?: boolean; // Use /p3/serviceValidate endpoint
  },
): string {
  const endpoint = options?.p3 ? "/p3/serviceValidate" : "/serviceValidate";
  let url = `${casServerUrl}${endpoint}?service=${encodeURIComponent(serviceUrl)}&ticket=${encodeURIComponent(ticket)}`;

  if (options?.pgtUrl) {
    url += `&pgtUrl=${encodeURIComponent(options.pgtUrl)}`;
  }
  if (options?.renew) {
    url += "&renew=true";
  }
  if (options?.format) {
    url += `&format=${options.format}`;
  }

  return url;
}

/**
 * Build CAS proxyValidate URL
 */
export function buildProxyValidateUrl(
  casServerUrl: string,
  serviceUrl: string,
  ticket: string,
  options?: {
    pgtUrl?: string;
    p3?: boolean;
  },
): string {
  const endpoint = options?.p3 ? "/p3/proxyValidate" : "/proxyValidate";
  let url = `${casServerUrl}${endpoint}?service=${encodeURIComponent(serviceUrl)}&ticket=${encodeURIComponent(ticket)}`;

  if (options?.pgtUrl) {
    url += `&pgtUrl=${encodeURIComponent(options.pgtUrl)}`;
  }

  return url;
}

/**
 * Build CAS proxy URL (to request a proxy ticket)
 */
export function buildProxyUrl(
  casServerUrl: string,
  pgt: string,
  targetService: string,
): string {
  return `${casServerUrl}/proxy?pgt=${encodeURIComponent(pgt)}&targetService=${encodeURIComponent(targetService)}`;
}

/**
 * Build samlValidate URL
 */
export function buildSamlValidateUrl(
  casServerUrl: string,
  targetService: string,
): string {
  return `${casServerUrl}/samlValidate?TARGET=${encodeURIComponent(targetService)}`;
}

/**
 * Normalize CAS server URL (remove trailing slash)
 */
export function normalizeCasServerUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Parse service URL from request
 * Handles both 'service' and 'TARGET' parameters
 */
export function parseServiceFromRequest(params: {
  service?: string;
  TARGET?: string;
}): string | null {
  return params.service || params.TARGET || null;
}

/**
 * Default ticket TTL values (in milliseconds)
 */
export const DEFAULT_TICKET_TTL = {
  ST: 5 * 60 * 1000, // 5 minutes for Service Tickets
  PT: 5 * 60 * 1000, // 5 minutes for Proxy Tickets
  PGT: 2 * 60 * 60 * 1000, // 2 hours for Proxy Granting Tickets
};

/**
 * Calculate expiration timestamp
 */
export function calculateExpiration(ttlMs: number): number {
  return Date.now() + ttlMs;
}

/**
 * Check if a timestamp has expired
 */
export function isExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}
