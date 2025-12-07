/**
 * CAS Issuer type definitions
 */

import type {
  CASTicket,
  CASAppConfig,
  CASAccessControlPolicy,
  CASLoginResult,
  CASLogoutResult,
  CASProxyResult,
} from "@lemonldap-ng/lib-cas";

// Session store interface for CAS tickets
export interface CASTicketStore {
  get(ticketId: string): Promise<CASTicket | null>;
  set(ticketId: string, ticket: CASTicket): Promise<void>;
  delete(ticketId: string): Promise<void>;
}

// PGTIOU store interface
export interface CASPGTIOUStore {
  get(pgtiou: string): Promise<string | null>; // Returns PGT ID
  set(pgtiou: string, pgtId: string): Promise<void>;
  delete(pgtiou: string): Promise<void>;
}

// Session data from portal
export interface PortalSessionData {
  _session_id: string;
  _user: string;
  _authLevel?: number;
  _utime?: number;
  [key: string]: unknown;
}

// CAS Issuer configuration
export interface CASIssuerConfig {
  // Applications configuration
  casAppMetaDataOptions: Record<string, CASAppConfig>;

  // Access control policy: "error" (reject), "faketicket" (return fake), "none" (allow all)
  casAccessControlPolicy?: CASAccessControlPolicy;

  // Ticket storage
  ticketStore: CASTicketStore;

  // PGTIOU storage (optional, needed for proxy support)
  pgtIOUStore?: CASPGTIOUStore;

  // Session store for retrieving user session data
  getSession: (sessionId: string) => Promise<PortalSessionData | null>;

  // HTTP client for PGT callback
  httpClient?: {
    get(url: string): Promise<{ status: number; body: string }>;
  };

  // Ticket TTL in milliseconds
  ticketTTL?: {
    ST?: number;
    PT?: number;
    PGT?: number;
  };

  // Single Logout callback
  onLogout?: (sessionId: string, apps: string[]) => Promise<void>;

  // Logger
  logger?: {
    debug: (msg: string, ...args: unknown[]) => void;
    info: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
  };
}

// Login request parameters
export interface CASLoginRequest {
  service?: string;
  renew?: boolean;
  gateway?: boolean;
}

// Logout request parameters
export interface CASLogoutRequest {
  service?: string;
  url?: string; // CAS 2.0 compatibility
}

// Validate request parameters
export interface CASValidateRequest {
  service: string;
  ticket: string;
  renew?: boolean;
}

// ServiceValidate request parameters
export interface CASServiceValidateRequest {
  service: string;
  ticket: string;
  pgtUrl?: string;
  renew?: boolean;
  format?: "XML" | "JSON";
}

// ProxyValidate request parameters
export interface CASProxyValidateRequest {
  service: string;
  ticket: string;
  pgtUrl?: string;
}

// Proxy request parameters
export interface CASProxyRequest {
  pgt: string;
  targetService: string;
}

// SAML validate request parameters
export interface CASSamlValidateRequest {
  TARGET: string;
  body: string;
}

// CAS issuer handler result types
export type CASIssuerLoginResult = CASLoginResult;
export type CASIssuerLogoutResult = CASLogoutResult;
export type CASIssuerValidateResult = string; // Plain text response
export type CASIssuerServiceValidateResult = string; // XML response
export type CASIssuerProxyValidateResult = string; // XML response
export type CASIssuerProxyResult = CASProxyResult | string; // XML response
export type CASIssuerSamlValidateResult = string; // SOAP/SAML response

// App registration for SLO
export interface CASAppRegistration {
  confKey: string;
  service: string;
  sessionId: string;
  ticketId: string;
}
