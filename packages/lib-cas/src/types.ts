/**
 * CAS (Central Authentication Service) type definitions
 */

// Ticket types
export type CASTicketType = "ST" | "PT" | "PGT" | "PGTIOU";

export interface CASTicket {
  id: string;
  type: CASTicketType;
  service: string;
  userId: string;
  primarySessionId: string;
  createdAt: number;
  expiresAt: number;
  renew?: boolean;
  proxies?: string[]; // For PT: proxy chain
  pgtId?: string; // Associated PGT for PT
}

// CAS application configuration (for IdP)
export interface CASAppMetaDataOptions {
  casAppMetaDataOptionsService: string; // Service URL pattern
  casAppMetaDataOptionsDisplayName?: string;
  casAppMetaDataOptionsLogout?: -1 | 0 | 1; // -1=excluded, 0=no, 1=yes
  casAppMetaDataOptionsAuthnLevel?: number;
  casAppMetaDataOptionsRule?: string;
  casAppMetaDataOptionsAllowProxy?: boolean;
}

export interface CASAppMetaDataExportedVars {
  [key: string]: string; // CAS attribute name -> session key
}

export interface CASAppConfig {
  casAppMetaDataOptions: CASAppMetaDataOptions;
  casAppMetaDataExportedVars?: CASAppMetaDataExportedVars;
}

// CAS server configuration (for SP)
export interface CASSrvMetaDataOptions {
  casSrvMetaDataOptionsUrl: string; // CAS server URL
  casSrvMetaDataOptionsRenew?: boolean;
  casSrvMetaDataOptionsGateway?: boolean;
  casSrvMetaDataOptionsSamlValidate?: boolean; // Use SAML validate
  casSrvMetaDataOptionsProxiedServices?: Record<string, string>;
  casSrvMetaDataOptionsDisplayName?: string;
}

export interface CASSrvMetaDataExportedVars {
  [key: string]: string; // Session key -> CAS attribute name
}

export interface CASSrvConfig {
  casSrvMetaDataOptions: CASSrvMetaDataOptions;
  casSrvMetaDataExportedVars?: CASSrvMetaDataExportedVars;
}

// CAS session data
export interface CASSessionData {
  _cas_id?: string; // Primary session ID
  _casApp?: string; // App confKey
  _casSrvCurrent?: string; // Current CAS server (SP)
  _casPT?: Record<string, string>; // Proxy tickets by service
  pgtId?: string; // Proxy Granting Ticket
}

// CAS validate results
export interface CASValidateSuccess {
  success: true;
  user: string;
  attributes?: Record<string, string[]>;
  pgtIou?: string;
  proxies?: string[];
}

export interface CASValidateError {
  success: false;
  code: string;
  message: string;
}

export type CASValidateResult = CASValidateSuccess | CASValidateError;

// CAS error codes
export const CAS_ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_TICKET_SPEC: "INVALID_TICKET_SPEC",
  UNAUTHORIZED_SERVICE_PROXY: "UNAUTHORIZED_SERVICE_PROXY",
  INVALID_PROXY_CALLBACK: "INVALID_PROXY_CALLBACK",
  INVALID_TICKET: "INVALID_TICKET",
  INVALID_SERVICE: "INVALID_SERVICE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type CASErrorCode =
  (typeof CAS_ERROR_CODES)[keyof typeof CAS_ERROR_CODES];

// CAS access control policies
export type CASAccessControlPolicy = "error" | "faketicket" | "none";

// Login/Logout results
export interface CASLoginRedirect {
  type: "redirect";
  url: string;
}

export interface CASLoginError {
  type: "error";
  code: CASErrorCode;
  message: string;
}

export interface CASLoginUpgrade {
  type: "upgrade";
  targetLevel: number;
}

export interface CASLoginGateway {
  type: "gateway";
  url: string;
}

export type CASLoginResult =
  | CASLoginRedirect
  | CASLoginError
  | CASLoginUpgrade
  | CASLoginGateway;

export interface CASLogoutResult {
  redirectUrl?: string;
  logoutApps?: string[];
}

// Proxy result
export interface CASProxySuccess {
  success: true;
  proxyTicket: string;
}

export interface CASProxyError {
  success: false;
  code: CASErrorCode;
  message: string;
}

export type CASProxyResult = CASProxySuccess | CASProxyError;

// SAML validate request
export interface SAMLValidateRequest {
  ticket: string;
  requestId?: string;
  issueInstant?: string;
}

// Credentials for CAS SP
export interface CASCredentials {
  ticket: string;
  service: string;
  serverKey: string;
}
