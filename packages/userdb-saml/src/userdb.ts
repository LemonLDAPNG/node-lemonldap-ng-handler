/**
 * SAML User Database Module
 *
 * Extracts user attributes from SAML assertions and maps them
 * to session variables.
 */

import type { Logger, SAMLIdPMetaDataOptions } from "@lemonldap-ng/lib-saml";
import type { SAMLUserDBConfig, SAMLUserInfo } from "./types";

/**
 * Default logger implementation
 */
const defaultLogger: Logger = {
  error: console.error,
  warn: console.warn,
  notice: console.log,
  info: console.log,
  debug: () => {},
};

/**
 * SAML User Database class
 */
export class SAMLUserDB {
  readonly name = "SAML";

  private config: SAMLUserDBConfig;
  private logger: Logger;

  constructor(config: SAMLUserDBConfig) {
    this.config = config;
    this.logger = config.logger || defaultLogger;
  }

  /**
   * Initialize the user database
   */
  async init(): Promise<void> {
    this.logger.info("SAML UserDB: Initialized");
  }

  /**
   * Get user information from session data
   * Maps SAML attributes to session variables based on IdP configuration
   */
  async getUser(
    userId: string,
    session: Record<string, unknown>,
  ): Promise<SAMLUserInfo> {
    const attributes: Record<string, unknown> = {};

    // Get IdP config key from session
    const idpConfKey = session._idpConfKey as string | undefined;

    if (idpConfKey) {
      // Get attribute mapping for this IdP
      const attrMapping =
        this.config.samlIdPMetaDataExportedAttributes?.[idpConfKey];

      if (attrMapping) {
        // Map SAML attributes to session variables
        for (const [sessionKey, samlAttr] of Object.entries(attrMapping)) {
          // SAML attributes are typically stored with _saml_ prefix
          const value = session[`_saml_${samlAttr}`] || session[samlAttr];
          if (value !== undefined) {
            attributes[sessionKey] = value;
          }
        }
      }
    }

    // Copy any existing SAML attributes from session
    for (const [key, value] of Object.entries(session)) {
      if (key.startsWith("_saml_") && !key.startsWith("_saml_id")) {
        // Convert _saml_attrName to attrName
        const attrName = key.substring(6);
        if (!(attrName in attributes)) {
          attributes[attrName] = value;
        }
      }
    }

    this.logger.debug(
      `SAML UserDB: Got user ${userId} with ${Object.keys(attributes).length} attributes`,
    );

    return {
      userId,
      attributes,
    };
  }

  /**
   * Get IdP options by config key
   */
  getIdP(confKey: string): SAMLIdPMetaDataOptions | null {
    return this.config.samlIdPMetaDataOptions?.[confKey] || null;
  }

  /**
   * Get attribute mapping for an IdP
   */
  getAttributeMapping(idpConfKey: string): Record<string, string> | null {
    return this.config.samlIdPMetaDataExportedAttributes?.[idpConfKey] || null;
  }
}

export default SAMLUserDB;
