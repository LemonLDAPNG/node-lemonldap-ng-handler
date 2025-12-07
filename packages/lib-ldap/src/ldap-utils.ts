/**
 * LDAP utility functions
 */

/**
 * Escape special characters in LDAP filter values
 * Based on RFC 4515
 */
export function escapeFilterValue(value: string): string {
  return value
    .replace(/\\/g, "\\5c")
    .replace(/\*/g, "\\2a")
    .replace(/\(/g, "\\28")
    .replace(/\)/g, "\\29")
    .replace(/\0/g, "\\00");
}

/**
 * Escape special characters in LDAP DN values
 * Based on RFC 4514
 */
export function escapeDnValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\+/g, "\\+")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/=/g, "\\=")
    .replace(/\0/g, "\\00");
}

/**
 * Build LDAP filter from template by replacing $user variable
 * @param template Filter template, e.g., "(&(uid=$user)(objectClass=inetOrgPerson))"
 * @param user Username to substitute
 * @returns Interpolated and escaped filter
 */
export function buildFilter(template: string, user: string): string {
  const escapedUser = escapeFilterValue(user);
  return template.replace(/\$user/g, escapedUser);
}

/**
 * Parse LDAP URL to extract host, port, and protocol
 * Supports: ldap://, ldaps://, ldap+tls://
 */
export interface ParsedLDAPUrl {
  protocol: "ldap" | "ldaps" | "ldap+tls";
  host: string;
  port: number;
  useTLS: boolean;
  useStartTLS: boolean;
}

export function parseLDAPUrl(url: string): ParsedLDAPUrl {
  const match = url.match(/^(ldaps?(?:\+tls)?):\/\/([^:/]+)(?::(\d+))?/i);

  if (!match) {
    throw new Error(`Invalid LDAP URL: ${url}`);
  }

  const protocol = match[1].toLowerCase() as "ldap" | "ldaps" | "ldap+tls";
  const host = match[2];
  let port: number;

  if (match[3]) {
    port = parseInt(match[3], 10);
  } else {
    port = protocol === "ldaps" ? 636 : 389;
  }

  return {
    protocol,
    host,
    port,
    useTLS: protocol === "ldaps",
    useStartTLS: protocol === "ldap+tls",
  };
}

/**
 * Parse multiple LDAP URLs separated by comma or space
 */
export function parseLDAPUrls(urls: string): ParsedLDAPUrl[] {
  return urls
    .split(/[,\s]+/)
    .filter((url) => url.trim())
    .map((url) => parseLDAPUrl(url.trim()));
}

/**
 * Get attribute value from LDAP entry
 * Handles both single and multi-valued attributes
 */
export function getLdapValue(
  entry: Record<string, string | string[]>,
  attribute: string,
  separator: string = ";",
): string {
  // Special case for DN
  if (attribute.toLowerCase() === "dn") {
    return entry.dn as string;
  }

  const value = entry[attribute];

  if (value === undefined || value === null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(separator);
  }

  return String(value);
}

/**
 * Get attribute values as array from LDAP entry
 */
export function getLdapValues(
  entry: Record<string, string | string[]>,
  attribute: string,
): string[] {
  const value = entry[attribute];

  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [String(value)];
}

/**
 * Convert LDAP search deref option to ldapts format
 */
export function convertDerefOption(
  deref?: string,
): "never" | "search" | "find" | "always" {
  switch (deref?.toLowerCase()) {
    case "never":
      return "never";
    case "search":
      return "search";
    case "find":
      return "find";
    case "always":
      return "always";
    default:
      return "find";
  }
}

/**
 * Password policy error codes (RFC 3876)
 */
export const PPOLICY_ERRORS: Record<number, string> = {
  0: "PE_PP_PASSWORD_EXPIRED",
  1: "PE_PP_ACCOUNT_LOCKED",
  2: "PE_PP_CHANGE_AFTER_RESET",
  3: "PE_PP_PASSWORD_MOD_NOT_ALLOWED",
  4: "PE_PP_MUST_SUPPLY_OLD_PASSWORD",
  5: "PE_PP_INSUFFICIENT_PASSWORD_QUALITY",
  6: "PE_PP_PASSWORD_TOO_SHORT",
  7: "PE_PP_PASSWORD_TOO_YOUNG",
  8: "PE_PP_PASSWORD_IN_HISTORY",
};

/**
 * Map ppolicy error code to portal error code
 */
export function mapPpolicyError(errorCode: number): string {
  return PPOLICY_ERRORS[errorCode] || "PE_LDAPERROR";
}
