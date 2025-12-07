/**
 * CAS Issuer (Server/IdP) for LemonLDAP::NG
 * @module @lemonldap-ng/issuer-cas
 */

export { CASIssuer } from "./issuer";

export type {
  CASTicketStore,
  CASPGTIOUStore,
  PortalSessionData,
  CASIssuerConfig,
  CASLoginRequest,
  CASLogoutRequest,
  CASValidateRequest,
  CASServiceValidateRequest,
  CASProxyValidateRequest,
  CASProxyRequest,
  CASSamlValidateRequest,
  CASIssuerLoginResult,
  CASIssuerLogoutResult,
  CASIssuerValidateResult,
  CASIssuerServiceValidateResult,
  CASIssuerProxyValidateResult,
  CASIssuerProxyResult,
  CASIssuerSamlValidateResult,
  CASAppRegistration,
} from "./types";

// Re-export useful types from lib-cas
export type {
  CASTicket,
  CASAppConfig,
  CASAppMetaDataOptions,
  CASAppMetaDataExportedVars,
  CASAccessControlPolicy,
  CASLoginResult,
  CASLogoutResult,
  CASValidateResult,
  CASProxyResult,
} from "@lemonldap-ng/lib-cas";

export { CAS_ERROR_CODES } from "@lemonldap-ng/lib-cas";
