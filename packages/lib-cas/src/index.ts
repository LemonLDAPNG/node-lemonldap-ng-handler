/**
 * CAS library utilities for LemonLDAP::NG
 * @module @lemonldap-ng/lib-cas
 */

// Types
export type {
  CASTicketType,
  CASTicket,
  CASAppMetaDataOptions,
  CASAppMetaDataExportedVars,
  CASAppConfig,
  CASSrvMetaDataOptions,
  CASSrvMetaDataExportedVars,
  CASSrvConfig,
  CASSessionData,
  CASValidateSuccess,
  CASValidateError,
  CASValidateResult,
  CASErrorCode,
  CASAccessControlPolicy,
  CASLoginRedirect,
  CASLoginError,
  CASLoginUpgrade,
  CASLoginGateway,
  CASLoginResult,
  CASLogoutResult,
  CASProxySuccess,
  CASProxyError,
  CASProxyResult,
  SAMLValidateRequest,
  CASCredentials,
} from "./types";

export { CAS_ERROR_CODES } from "./types";

// Ticket generation
export {
  generateServiceTicket,
  generateProxyTicket,
  generatePGT,
  generatePGTIOU,
  isValidTicketFormat,
  isValidPGTIOUFormat,
  getTicketType,
} from "./ticket";

// XML building
export {
  escapeXml,
  buildValidateSuccess,
  buildValidateFailure,
  buildServiceValidateSuccess,
  buildServiceValidateError,
  buildProxySuccess,
  buildProxyError,
  buildSamlValidateSuccess,
  buildSamlValidateError,
  buildLogoutRequest,
} from "./xml-builder";

// XML parsing
export {
  parseSamlValidateRequest,
  parseServiceValidateResponse,
  parseValidateResponse,
  parseSamlValidateResponse,
  parseProxyResponse,
} from "./xml-parser";

// Utilities
export {
  isServiceUrlValid,
  extractServiceUrl,
  appendQueryParam,
  buildCasLoginUrl,
  buildCasLogoutUrl,
  buildValidateUrl,
  buildServiceValidateUrl,
  buildProxyValidateUrl,
  buildProxyUrl,
  buildSamlValidateUrl,
  normalizeCasServerUrl,
  parseServiceFromRequest,
  DEFAULT_TICKET_TTL,
  calculateExpiration,
  isExpired,
} from "./utils";
