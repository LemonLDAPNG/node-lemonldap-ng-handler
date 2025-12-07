/**
 * CAS Auth (SP) type definitions
 */

import type {
  CASSrvConfig,
  CASSrvMetaDataOptions,
  CASSrvMetaDataExportedVars,
  CASValidateResult,
} from "@lemonldap-ng/lib-cas";

// HTTP client interface
export interface HttpClient {
  get(url: string): Promise<HttpResponse>;
  post(url: string, body: string, contentType?: string): Promise<HttpResponse>;
}

export interface HttpResponse {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

// CAS Auth configuration
export interface CASAuthConfig {
  // CAS server configurations
  casSrvMetaDataOptions: Record<string, CASSrvConfig>;

  // Default CAS server (confKey)
  casSrvDefault?: string;

  // Service URL for this application
  serviceUrl: string;

  // HTTP client for making validation requests
  httpClient: HttpClient;

  // Validation method: "serviceValidate" (CAS 2.0) or "samlValidate" (SAML 1.0)
  validationMethod?: "serviceValidate" | "samlValidate";

  // Logger
  logger?: {
    debug: (msg: string, ...args: unknown[]) => void;
    info: (msg: string, ...args: unknown[]) => void;
    warn: (msg: string, ...args: unknown[]) => void;
    error: (msg: string, ...args: unknown[]) => void;
  };
}

// Extracted credentials from request
export interface CASExtractedCredentials {
  ticket: string;
  service: string;
  serverKey: string;
}

// Authentication result
export interface CASAuthSuccess {
  success: true;
  userId: string;
  attributes: Record<string, string[]>;
  sessionData: Record<string, unknown>;
  serverKey: string;
}

export interface CASAuthError {
  success: false;
  error: string;
  code?: string;
}

export type CASAuthResult = CASAuthSuccess | CASAuthError;

// Server info for selection UI
export interface CASServerInfo {
  confKey: string;
  displayName: string;
  url: string;
}

// Request interface (minimal subset for credential extraction)
export interface CASAuthRequest {
  url?: string;
  query?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
}

// Re-export useful types
export type {
  CASSrvConfig,
  CASSrvMetaDataOptions,
  CASSrvMetaDataExportedVars,
  CASValidateResult,
};
