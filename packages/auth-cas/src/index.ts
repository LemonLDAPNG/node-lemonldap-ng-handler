/**
 * CAS Authentication module (SP/Client) for LemonLDAP::NG
 * @module @lemonldap-ng/auth-cas
 */

export { CASAuth } from "./auth";

export type {
  HttpClient,
  HttpResponse,
  CASAuthConfig,
  CASExtractedCredentials,
  CASAuthSuccess,
  CASAuthError,
  CASAuthResult,
  CASServerInfo,
  CASAuthRequest,
  CASSrvConfig,
  CASSrvMetaDataOptions,
  CASSrvMetaDataExportedVars,
  CASValidateResult,
} from "./types";
