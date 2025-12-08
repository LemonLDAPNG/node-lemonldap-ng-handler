/**
 * SAML Issuer (IdP)
 *
 * Handles SAML 2.0 IdP operations including:
 * - SSO (Single Sign-On)
 * - SLO (Single Logout)
 * - Metadata generation
 */

import {
  ServerManager,
  Login,
  Logout,
  Identity,
  Session,
  HttpMethod,
  AuthnContext,
  nameIdFormatToUrn,
  extractSamlMessage,
  buildPostForm,
  type Logger,
  type SAMLSPMetaDataOptions,
  type SamlAttribute,
  type NameIdFormatType,
} from "@lemonldap-ng/lib-saml";

import type {
  SAMLIssuerConfig,
  SSOContext,
  SLOContext,
  SAMLResponse,
} from "./types";

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
 * SAML Issuer class
 */
export class SAMLIssuer {
  private config: SAMLIssuerConfig;
  private logger: Logger;
  private serverManager: ServerManager;
  private initialized = false;

  constructor(config: SAMLIssuerConfig) {
    this.config = config;
    this.logger = config.logger || defaultLogger;
    this.serverManager = new ServerManager(
      {
        ...config,
        samlSPMetaDataXML: config.samlSPMetaDataXML,
      },
      this.logger,
    );
  }

  /**
   * Initialize the SAML Issuer
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await this.serverManager.init();
    this.initialized = true;
    this.logger.info("SAML Issuer: Initialized");
  }

  /**
   * Get the IdP metadata
   */
  getMetadata(): string {
    return this.serverManager.getMetadata();
  }

  /**
   * Get SP options by entity ID
   */
  getSPByEntityId(entityId: string): {
    confKey: string;
    options: SAMLSPMetaDataOptions;
  } | null {
    if (!this.config.samlSPMetaDataOptions) return null;

    for (const [confKey, options] of Object.entries(
      this.config.samlSPMetaDataOptions,
    )) {
      const spEntityId =
        options.samlSPMetaDataOptionsEntityID ||
        this.extractEntityIdFromMetadata(confKey);
      if (spEntityId === entityId) {
        return { confKey, options };
      }
    }
    return null;
  }

  /**
   * Extract entity ID from metadata XML for a config key
   */
  private extractEntityIdFromMetadata(confKey: string): string | null {
    const xml = this.config.samlSPMetaDataXML?.[confKey];
    if (!xml) return null;
    const match = xml.match(/entityID=["']([^"']+)["']/);
    return match ? match[1] : null;
  }

  /**
   * Process an incoming AuthnRequest
   */
  async processAuthnRequest(req: {
    method?: string;
    body?: Record<string, string>;
    query?: Record<string, string>;
  }): Promise<SSOContext> {
    const { message, relayState, method } = extractSamlMessage(req);

    if (!message) {
      throw new Error("No SAMLRequest found in request");
    }

    const server = this.serverManager.getServer();
    const login = new Login(server);

    // Process the AuthnRequest
    // For REDIRECT binding, lasso expects the full query string format
    let processMessage = message;
    if (method === HttpMethod.REDIRECT) {
      // Build query string format that lasso expects
      processMessage = `SAMLRequest=${encodeURIComponent(message)}`;
      if (relayState) {
        processMessage += `&RelayState=${encodeURIComponent(relayState)}`;
      }
    }
    login.processAuthnRequestMsg(processMessage, method);
    login.validateRequestMsg();

    const spEntityId = login.remoteProviderId;
    if (!spEntityId) {
      throw new Error("Could not determine SP entity ID");
    }

    // Find SP configuration
    const sp = this.getSPByEntityId(spEntityId);
    if (!sp) {
      throw new Error(`Unknown SP: ${spEntityId}`);
    }

    // Check access rule if defined
    if (sp.options.samlSPMetaDataOptionsRule) {
      // Rule evaluation would be done by the portal
      this.logger.debug(`SAML Issuer: SP ${sp.confKey} has access rule`);
    }

    const context: SSOContext = {
      spEntityId,
      spConfKey: sp.confKey,
      spOptions: sp.options,
      relayState: relayState || undefined,
      requestedNameIdFormat: login.nameIdFormat || undefined,
      httpMethod: method === HttpMethod.POST ? "POST" : "GET",
    };

    this.logger.info(`SAML Issuer: Received AuthnRequest from ${spEntityId}`);
    return context;
  }

  /**
   * Build a SAML Response for an authenticated user
   */
  async buildSAMLResponse(
    context: SSOContext,
    session: Record<string, unknown>,
    sessionId: string,
  ): Promise<SAMLResponse> {
    const server = this.serverManager.getServer();
    const login = new Login(server);

    // Restore identity if available
    const existingIdentity = await this.config.getIdentity?.(
      String(session._user || session.uid || ""),
      context.spEntityId,
    );
    if (existingIdentity) {
      login.identity = Identity.fromDump(existingIdentity);
    }

    // Get or create session
    const existingSamlSession = await this.config.getSAMLSession?.(sessionId);
    if (existingSamlSession?._lassoSessionDump) {
      login.session = Session.fromDump(existingSamlSession._lassoSessionDump);
    } else {
      login.session = new Session();
    }

    // Determine NameID
    const nameIdFormat = this.getNameIdFormat(context);
    const nameIdValue = this.getNameIdValue(context, session);

    // Set NameID
    login.setNameId(nameIdValue, nameIdFormat as NameIdFormatType);

    // Set attributes
    const attributes = this.buildAttributes(context, session);
    if (attributes.length > 0) {
      login.setAttributes(attributes);
    }

    // Build assertion
    const authTime = session._authTime
      ? new Date((session._authTime as number) * 1000).toISOString()
      : new Date().toISOString();
    login.buildAssertion(AuthnContext.PASSWORD, authTime);

    // Build response
    const result = login.buildResponseMsg();

    // Store identity and session
    if (login.identity && !login.identity.isEmpty) {
      await this.config.storeIdentity?.(
        String(session._user || session.uid || ""),
        context.spEntityId,
        login.identity.dump() || "",
      );
    }

    if (login.session && login.session.isDirty) {
      await this.config.storeSAMLSession?.(sessionId, {
        _saml_id: sessionId,
        _lassoSessionDump: login.session.dump() || undefined,
        _samlNameIdFormat: nameIdFormat,
        _samlNameIdValue: nameIdValue,
      });
    }

    this.logger.info(
      `SAML Issuer: Built SAML Response for ${context.spEntityId}`,
    );

    // Return response based on binding
    if (result.httpMethod === HttpMethod.POST) {
      const formHtml = buildPostForm(result.responseUrl, {
        SAMLResponse: result.responseBody || "",
        ...(context.relayState && { RelayState: context.relayState }),
      });

      return {
        url: result.responseUrl,
        method: "POST",
        formData: {
          SAMLResponse: result.responseBody,
          RelayState: context.relayState,
        },
        body: formHtml,
        contentType: "text/html",
      };
    }

    // Redirect binding
    return {
      url: result.responseUrl,
      method: "GET",
    };
  }

  /**
   * Process an incoming LogoutRequest
   */
  async processLogoutRequest(req: {
    method?: string;
    body?: Record<string, string>;
    query?: Record<string, string>;
  }): Promise<SLOContext> {
    const { message, relayState, method, isRequest } = extractSamlMessage(req);

    if (!message) {
      throw new Error("No SAML message found in request");
    }

    const server = this.serverManager.getServer();
    const logout = new Logout(server);

    if (isRequest) {
      logout.processRequestMsg(message, method);
      logout.validateRequest();
    } else {
      logout.processResponseMsg(message);
    }

    const providerEntityId = ""; // Extract from logout object if available

    return {
      providerEntityId,
      providerConfKey: "",
      isRequest,
      relayState: relayState || undefined,
      httpMethod: method === HttpMethod.POST ? "POST" : "GET",
    };
  }

  /**
   * Build a LogoutResponse
   */
  async buildLogoutResponse(context: SLOContext): Promise<SAMLResponse> {
    const server = this.serverManager.getServer();
    const logout = new Logout(server);

    // Set identity/session if available
    // These would be restored from stored session data

    const result = logout.buildResponseMsg();

    this.logger.info(
      `SAML Issuer: Built LogoutResponse for ${context.providerEntityId}`,
    );

    if (result.httpMethod === HttpMethod.POST) {
      const formHtml = buildPostForm(result.responseUrl, {
        SAMLResponse: result.responseBody || "",
        ...(context.relayState && { RelayState: context.relayState }),
      });

      return {
        url: result.responseUrl,
        method: "POST",
        formData: {
          SAMLResponse: result.responseBody,
          RelayState: context.relayState,
        },
        body: formHtml,
        contentType: "text/html",
      };
    }

    return {
      url: result.responseUrl,
      method: "GET",
    };
  }

  /**
   * Initiate IdP-initiated logout
   */
  async initiateLogout(
    sessionId: string,
    method: HttpMethod = HttpMethod.REDIRECT,
  ): Promise<SAMLResponse | null> {
    const samlSession = await this.config.getSAMLSession?.(sessionId);
    if (!samlSession?._lassoSessionDump) {
      return null;
    }

    const server = this.serverManager.getServer();
    const logout = new Logout(server);

    logout.session = Session.fromDump(samlSession._lassoSessionDump);

    // Get next provider to notify
    const nextProvider = logout.getNextProviderId();
    if (!nextProvider) {
      return null;
    }

    logout.initRequest(nextProvider, method);
    const result = logout.buildRequestMsg();

    this.logger.info(`SAML Issuer: Initiated logout to ${nextProvider}`);

    if (result.httpMethod === HttpMethod.POST) {
      const formHtml = buildPostForm(result.responseUrl, {
        SAMLRequest: result.responseBody || "",
      });

      return {
        url: result.responseUrl,
        method: "POST",
        formData: {
          SAMLRequest: result.responseBody,
        },
        body: formHtml,
        contentType: "text/html",
      };
    }

    return {
      url: result.responseUrl,
      method: "GET",
    };
  }

  /**
   * Get NameID format for response
   */
  private getNameIdFormat(context: SSOContext): string {
    // Use requested format or SP config or default
    if (context.requestedNameIdFormat) {
      return context.requestedNameIdFormat;
    }

    const spFormat = context.spOptions.samlSPMetaDataOptionsNameIDFormat;
    if (spFormat) {
      return nameIdFormatToUrn(spFormat);
    }

    return "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent";
  }

  /**
   * Get NameID value from session
   */
  private getNameIdValue(
    context: SSOContext,
    session: Record<string, unknown>,
  ): string {
    // Check for configured session key
    const sessionKey = context.spOptions.samlSPMetaDataOptionsNameIDSessionKey;
    if (sessionKey && session[sessionKey]) {
      return String(session[sessionKey]);
    }

    // Fallback to common attributes
    return String(
      session._user ||
        session.uid ||
        session.mail ||
        session._session_id ||
        "unknown",
    );
  }

  /**
   * Build SAML attributes from session
   */
  private buildAttributes(
    context: SSOContext,
    session: Record<string, unknown>,
  ): SamlAttribute[] {
    const attributes: SamlAttribute[] = [];

    // Get exported attributes for this SP
    const exportedAttrs =
      this.config.samlSPMetaDataExportedAttributes?.[context.spConfKey];

    if (!exportedAttrs) {
      return attributes;
    }

    for (const attr of exportedAttrs) {
      const value = session[attr.sessionKey];
      if (value !== undefined && value !== null) {
        const values = Array.isArray(value)
          ? value.map(String)
          : [String(value)];

        attributes.push({
          name: attr.name,
          nameFormat: attr.nameFormat,
          values,
        });
      }
    }

    return attributes;
  }

  /**
   * Shutdown the issuer
   */
  shutdown(): void {
    this.serverManager.shutdown();
    this.initialized = false;
    this.logger.info("SAML Issuer: Shutdown");
  }
}

export default SAMLIssuer;
