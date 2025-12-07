/**
 * @lemonldap-ng/lib-saml
 *
 * SAML utilities and server management for LemonLDAP::NG
 *
 * @packageDocumentation
 */

// Export types
export * from "./types";

// Export ServerManager
export { ServerManager, type ServerManagerConfig } from "./server-manager";

// Export utilities
export {
  bindingToHttpMethod,
  httpMethodToBinding,
  nameIdFormatToUrn,
  urnToNameIdFormat,
  signatureMethodToEnum,
  detectHttpMethod,
  extractSamlMessage,
  decodeSamlMessage,
  generateSamlId,
  generateIsoTimestamp,
  parseIsoTimestamp,
  isTimestampValid,
  buildPostForm,
  escapeHtml,
  escapeXml,
  buildUrl,
  parseQueryString,
} from "./utils";

// Re-export key lasso.js items for convenience
export {
  init as initLasso,
  shutdown as shutdownLasso,
  isInitialized as isLassoInitialized,
  checkVersion as lassoVersion,
  Server,
  Login,
  Logout,
  Identity,
  Session,
  HttpMethod,
  SignatureMethod,
  NameIdFormat,
  AuthnContext,
} from "lasso.js";
