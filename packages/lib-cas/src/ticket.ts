/**
 * CAS ticket generation utilities
 */

import { CASTicketType } from "./types";

/**
 * Generate a random hex string
 */
function generateRandomHex(length: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate a UUID-like string
 */
function generateUUID(): string {
  return [
    generateRandomHex(8),
    generateRandomHex(4),
    generateRandomHex(4),
    generateRandomHex(4),
    generateRandomHex(12),
  ].join("-");
}

/**
 * Generate a CAS ticket with the given prefix
 */
function generateTicket(prefix: CASTicketType): string {
  return `${prefix}-${generateUUID()}`;
}

/**
 * Generate a Service Ticket (ST)
 * Used for initial authentication
 */
export function generateServiceTicket(): string {
  return generateTicket("ST");
}

/**
 * Generate a Proxy Ticket (PT)
 * Used for proxy authentication
 */
export function generateProxyTicket(): string {
  return generateTicket("PT");
}

/**
 * Generate a Proxy Granting Ticket (PGT)
 * Used to obtain proxy tickets
 */
export function generatePGT(): string {
  return generateTicket("PGT");
}

/**
 * Generate a Proxy Granting Ticket IOU (PGTIOU)
 * Used as a reference to retrieve the actual PGT
 */
export function generatePGTIOU(): string {
  return `PGTIOU-${generateUUID()}`;
}

/**
 * Validate ticket format
 */
export function isValidTicketFormat(
  ticket: string,
  expectedType?: CASTicketType,
): boolean {
  if (!ticket) return false;

  const match = ticket.match(/^(ST|PT|PGT)-[a-f0-9-]{36}$/);
  if (!match) return false;

  if (expectedType && match[1] !== expectedType) {
    return false;
  }

  return true;
}

/**
 * Validate PGTIOU format
 */
export function isValidPGTIOUFormat(pgtiou: string): boolean {
  if (!pgtiou) return false;
  return /^PGTIOU-[a-f0-9-]{36}$/.test(pgtiou);
}

/**
 * Extract ticket type from ticket string
 */
export function getTicketType(ticket: string): CASTicketType | null {
  const match = ticket.match(/^(ST|PT|PGT)-/);
  if (!match) return null;
  return match[1] as CASTicketType;
}
