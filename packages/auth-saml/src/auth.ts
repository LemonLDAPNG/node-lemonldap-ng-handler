/**
 * SAML SP Authentication Module
 *
 * Handles SAML 2.0 SP operations including:
 * - AuthnRequest generation
 * - SAMLResponse processing
 * - SLO (Single Logout)
 */

import {
  ServerManager,
  Login,
  Logout,
  Identity,
  Session,
  HttpMethod,
  bindingToHttpMethod,
  extractSamlMessage,
  generateSamlId,
  type Logger,
  type SAMLIdPMetaDataOptions,
  type SAMLAuthResult,
  type SAMLRedirectResponse,
} from "@lemonldap-ng/lib-saml";

import type { SAMLAuthConfig, SAMLAuthState, SAMLCredentials } from "./types";

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
 * SAML SP Authentication class
 */
export class SAMLAuth {
  readonly name = "SAML";

  private config: SAMLAuthConfig;
  private logger: Logger;
  private serverManager: ServerManager;
  private initialized = false;

  constructor(config: SAMLAuthConfig) {
    this.config = config;
    this.logger = config.logger || defaultLogger;
    this.serverManager = new ServerManager(
      {
        ...config,
        samlIdPMetaDataXML: config.samlIdPMetaDataXML,
      },
      this.logger,
    );
  }

  /**
   * Initialize the SAML SP
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await this.serverManager.init();
    this.initialized = true;
    this.logger.info("SAML Auth: Initialized");
  }

  /**
   * Get the SP metadata
   */
  getMetadata(): string {
    return this.serverManager.getMetadata();
  }

  /**
   * Get IdP options by config key
   */
  getIdP(confKey: string): SAMLIdPMetaDataOptions | null {
    return this.config.samlIdPMetaDataOptions?.[confKey] || null;
  }

  /**
   * Get IdP by entity ID
   */
  getIdPByEntityId(entityId: string): {
    confKey: string;
    options: SAMLIdPMetaDataOptions;
  } | null {
    if (!this.config.samlIdPMetaDataOptions) return null;

    for (const [confKey, options] of Object.entries(
      this.config.samlIdPMetaDataOptions,
    )) {
      const idpEntityId =
        options.samlIdPMetaDataOptionsEntityID ||
        this.extractEntityIdFromMetadata(confKey);
      if (idpEntityId === entityId) {
        return { confKey, options };
      }
    }
    return null;
  }

  /**
   * Get default IdP config key
   */
  getDefaultIdP(): string | null {
    if (this.config.samlIdPDefault) {
      return this.config.samlIdPDefault;
    }

    // Return first IdP if only one is configured
    const idpKeys = Object.keys(this.config.samlIdPMetaDataOptions || {});
    if (idpKeys.length === 1) {
      return idpKeys[0];
    }

    return null;
  }

  /**
   * Get list of available IdPs for choice
   */
  getIdPList(): Array<{ confKey: string; options: SAMLIdPMetaDataOptions }> {
    const result: Array<{ confKey: string; options: SAMLIdPMetaDataOptions }> =
      [];

    const allowedKeys = this.config.samlIdPList;
    const allOptions = this.config.samlIdPMetaDataOptions || {};

    for (const [confKey, options] of Object.entries(allOptions)) {
      if (!allowedKeys || allowedKeys.includes(confKey)) {
        if (options.samlIdPMetaDataOptionsAllowLoginFromIDP !== false) {
          result.push({ confKey, options });
        }
      }
    }

    // Sort by display order if available
    result.sort((a, b) => {
      const orderA = a.options.samlIdPMetaDataOptionsDisplayOrder || 0;
      const orderB = b.options.samlIdPMetaDataOptionsDisplayOrder || 0;
      return orderA - orderB;
    });

    return result;
  }

  /**
   * Extract entity ID from metadata XML for a config key
   */
  private extractEntityIdFromMetadata(confKey: string): string | null {
    const xml = this.config.samlIdPMetaDataXML?.[confKey];
    if (!xml) return null;
    const match = xml.match(/entityID=["']([^"']+)["']/);
    return match ? match[1] : null;
  }

  /**
   * Build AuthnRequest and return redirect URL
   */
  async buildAuthnRequest(
    idpConfKey: string,
    returnUrl?: string,
  ): Promise<SAMLRedirectResponse> {
    const idpOptions = this.getIdP(idpConfKey);
    if (!idpOptions) {
      throw new Error(`Unknown IdP: ${idpConfKey}`);
    }

    const idpEntityId =
      idpOptions.samlIdPMetaDataOptionsEntityID ||
      this.extractEntityIdFromMetadata(idpConfKey);
    if (!idpEntityId) {
      throw new Error(`Could not determine entity ID for IdP: ${idpConfKey}`);
    }

    const server = this.serverManager.getServer();
    const login = new Login(server);

    // Determine binding method
    const binding =
      idpOptions.samlIdPMetaDataOptionsSSOBinding || "http-redirect";
    const method = bindingToHttpMethod(binding);

    // Initialize AuthnRequest
    login.initAuthnRequest(idpEntityId, method);

    // Store state for callback
    const stateId = generateSamlId();
    const now = Date.now();
    const timeout = (this.config.samlRelayStateTimeout || 600) * 1000;

    const state: SAMLAuthState = {
      idpConfKey,
      idpEntityId,
      returnUrl,
      createdAt: now,
      expiresAt: now + timeout,
    };

    await this.config.storeAuthState?.(stateId, state);

    // Set RelayState
    login.relayState = stateId;

    // Build request
    const result = login.buildAuthnRequestMsg();

    this.logger.info(`SAML Auth: Built AuthnRequest for ${idpEntityId}`);
    this.logger.debug(
      `SAML Auth: httpMethod=${result.httpMethod}, responseUrl=${result.responseUrl}`,
    );

    if (result.httpMethod === HttpMethod.POST) {
      return {
        url: result.responseUrl,
        method: "POST",
        formData: {
          SAMLRequest: result.responseBody,
          RelayState: stateId,
        },
      };
    }

    // For HTTP-Redirect binding, construct URL with SAMLRequest as query parameter
    // Lasso returns the SAMLRequest in responseBody (already base64 encoded)
    // We need to deflate it and add to URL
    if (result.httpMethod === HttpMethod.REDIRECT && result.responseBody) {
      const zlib = require("zlib");
      // The responseBody from lasso is already a proper AuthnRequest XML (base64 encoded)
      // For HTTP-Redirect, we need to deflate and base64 encode it
      const xmlRequest = Buffer.from(result.responseBody, "base64").toString(
        "utf-8",
      );
      const deflated = zlib.deflateRawSync(xmlRequest);
      const encoded = deflated.toString("base64");

      const url = new URL(result.responseUrl);
      url.searchParams.set("SAMLRequest", encoded);
      if (stateId) {
        url.searchParams.set("RelayState", stateId);
      }

      return {
        url: url.toString(),
        method: "GET",
      };
    }

    // Fallback: just return the URL (shouldn't happen normally)
    return {
      url: result.responseUrl,
      method: "GET",
    };
  }

  /**
   * Check if request contains SAML credentials
   */
  extractCredentials(req: {
    method?: string;
    body?: Record<string, string>;
    query?: Record<string, string>;
  }): SAMLCredentials | null {
    const { message, isRequest, relayState, method } = extractSamlMessage(req);

    // We expect a SAMLResponse, not a SAMLRequest
    if (!message || isRequest) {
      return null;
    }

    return {
      samlResponse: message,
      relayState: relayState || undefined,
      httpMethod: method === HttpMethod.POST ? "POST" : "GET",
    };
  }

  /**
   * Process SAML Response and authenticate user
   */
  async authenticate(credentials: SAMLCredentials): Promise<SAMLAuthResult> {
    // Retrieve auth state
    let state: SAMLAuthState | null = null;
    if (credentials.relayState) {
      state =
        (await this.config.consumeAuthState?.(credentials.relayState)) ?? null;
    }

    const server = this.serverManager.getServer();
    const login = new Login(server);

    try {
      // Process response
      login.processResponseMsg(credentials.samlResponse);
      login.acceptSso();

      // Get NameID and attributes
      const nameId = login.nameId;
      const nameIdFormat = login.nameIdFormat;
      const remoteProviderId = login.remoteProviderId;

      if (!nameId) {
        return {
          success: false,
          error: "No NameID in SAML response",
        };
      }

      // Find IdP configuration
      let idpConfKey = state?.idpConfKey;
      const idpEntityId = remoteProviderId || state?.idpEntityId;

      if (!idpConfKey && idpEntityId) {
        const idp = this.getIdPByEntityId(idpEntityId);
        if (idp) {
          idpConfKey = idp.confKey;
        }
      }

      // Get user ID from configured attribute or NameID
      const userId = this.getUserId(idpConfKey, nameId);

      this.logger.info(
        `SAML Auth: Authenticated user ${userId} from ${idpEntityId}`,
      );

      return {
        success: true,
        userId,
        nameId,
        nameIdFormat: nameIdFormat || undefined,
        idpEntityId: idpEntityId || undefined,
        identityDump: login.identity?.dump() || undefined,
        sessionDump: login.session?.dump() || undefined,
      };
    } catch (err) {
      this.logger.error(`SAML Auth: Authentication failed: ${err}`);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Get user ID from IdP configuration or NameID
   */
  private getUserId(idpConfKey: string | undefined, nameId: string): string {
    if (idpConfKey) {
      const options = this.getIdP(idpConfKey);
      if (options?.samlIdPMetaDataOptionsUserAttribute) {
        // The user attribute would be extracted from assertions
        // For now, return nameId
        return nameId;
      }
    }
    return nameId;
  }

  /**
   * Initiate SP-initiated logout
   */
  async initiateLogout(
    sessionId: string,
    idpConfKey?: string,
  ): Promise<SAMLRedirectResponse | null> {
    const samlSession = await this.config.getSAMLSession?.(sessionId);
    if (!samlSession) {
      return null;
    }

    // Determine IdP to logout from
    const confKey = idpConfKey || samlSession._idpConfKey;
    if (!confKey) {
      return null;
    }

    const idpOptions = this.getIdP(confKey);
    if (!idpOptions) {
      return null;
    }

    const idpEntityId =
      idpOptions.samlIdPMetaDataOptionsEntityID ||
      this.extractEntityIdFromMetadata(confKey);
    if (!idpEntityId) {
      return null;
    }

    const server = this.serverManager.getServer();
    const logout = new Logout(server);

    // Restore session
    if (samlSession._lassoSessionDump) {
      logout.session = Session.fromDump(samlSession._lassoSessionDump);
    }

    // Restore identity
    if (samlSession._lassoIdentityDump) {
      logout.identity = Identity.fromDump(samlSession._lassoIdentityDump);
    }

    // Set NameID for logout request
    // Note: setNameId is available on Logout class in lasso.js
    if (samlSession._samlNameIdValue) {
      (
        logout as unknown as {
          setNameId: (id: string, format?: string) => void;
        }
      ).setNameId(samlSession._samlNameIdValue, samlSession._samlNameIdFormat);
    }

    // Determine binding method
    const binding =
      idpOptions.samlIdPMetaDataOptionsSLOBinding || "http-redirect";
    const method = bindingToHttpMethod(binding);

    // Build logout request
    logout.initRequest(idpEntityId, method);
    const result = logout.buildRequestMsg();

    this.logger.info(`SAML Auth: Initiated logout to ${idpEntityId}`);

    if (result.httpMethod === HttpMethod.POST) {
      return {
        url: result.responseUrl,
        method: "POST",
        formData: {
          SAMLRequest: result.responseBody,
        },
      };
    }

    return {
      url: result.responseUrl,
      method: "GET",
    };
  }

  /**
   * Process logout response
   */
  async processLogoutResponse(req: {
    method?: string;
    body?: Record<string, string>;
    query?: Record<string, string>;
  }): Promise<boolean> {
    const { message, isRequest } = extractSamlMessage(req);

    if (!message || isRequest) {
      return false;
    }

    const server = this.serverManager.getServer();
    const logout = new Logout(server);

    try {
      logout.processResponseMsg(message);
      this.logger.info("SAML Auth: Processed logout response");
      return true;
    } catch (err) {
      this.logger.error(`SAML Auth: Logout response processing failed: ${err}`);
      return false;
    }
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    this.serverManager.shutdown();
    this.initialized = false;
    this.logger.info("SAML Auth: Shutdown");
  }
}

export default SAMLAuth;
