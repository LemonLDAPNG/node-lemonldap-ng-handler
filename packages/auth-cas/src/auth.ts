/**
 * CAS Authentication module (SP/Client)
 */

import {
  buildCasLoginUrl,
  buildCasLogoutUrl,
  buildServiceValidateUrl,
  buildSamlValidateUrl,
  extractServiceUrl,
  normalizeCasServerUrl,
  parseServiceValidateResponse,
  parseSamlValidateResponse,
  parseValidateResponse,
  getTicketType,
} from "@lemonldap-ng/lib-cas";

import type {
  CASAuthConfig,
  CASAuthRequest,
  CASExtractedCredentials,
  CASAuthResult,
  CASServerInfo,
  CASSrvConfig,
} from "./types";

const CAS_SERVER_COOKIE = "lemonldapcassrv";

export class CASAuth {
  readonly name = "CAS";
  private config: CASAuthConfig;

  constructor(config: CASAuthConfig) {
    this.config = {
      validationMethod: "serviceValidate",
      ...config,
    };
  }

  async init(): Promise<void> {
    this.log("debug", "CAS Auth module initialized");
  }

  /**
   * Extract CAS credentials (ticket) from request
   */
  extractCredentials(req: CASAuthRequest): CASExtractedCredentials | null {
    // Get ticket from query string
    const ticket = this.getQueryParam(req, "ticket");
    if (!ticket) {
      return null;
    }

    // Validate ticket format (ST- or PT-)
    const ticketType = getTicketType(ticket);
    if (!ticketType || (ticketType !== "ST" && ticketType !== "PT")) {
      this.log("debug", `Invalid ticket type: ${ticket}`);
      return null;
    }

    // Get CAS server from cookie or use default
    const serverKey =
      req.cookies?.[CAS_SERVER_COOKIE] || this.getDefaultServer();
    if (!serverKey) {
      this.log("warn", "No CAS server specified and no default configured");
      return null;
    }

    // Build service URL (current URL without ticket)
    const service = this.buildServiceUrl(req);

    return {
      ticket,
      service,
      serverKey,
    };
  }

  /**
   * Authenticate using CAS ticket
   */
  async authenticate(
    credentials: CASExtractedCredentials,
  ): Promise<CASAuthResult> {
    const { ticket, service, serverKey } = credentials;

    // Get server configuration
    const serverConfig = this.config.casSrvMetaDataOptions[serverKey];
    if (!serverConfig) {
      return {
        success: false,
        error: `Unknown CAS server: ${serverKey}`,
      };
    }

    const serverUrl = normalizeCasServerUrl(
      serverConfig.casSrvMetaDataOptions.casSrvMetaDataOptionsUrl,
    );

    // Choose validation method
    const useSamlValidate =
      serverConfig.casSrvMetaDataOptions.casSrvMetaDataOptionsSamlValidate ||
      this.config.validationMethod === "samlValidate";

    let result;
    if (useSamlValidate) {
      result = await this.validateWithSaml(serverUrl, service, ticket);
    } else {
      result = await this.validateWithServiceValidate(
        serverUrl,
        service,
        ticket,
      );
    }

    if (!result.success) {
      return {
        success: false,
        error: result.message,
        code: result.code,
      };
    }

    // Map attributes to session data
    const sessionData = this.mapAttributes(
      result.attributes || {},
      serverConfig.casSrvMetaDataExportedVars || {},
    );

    // Add CAS-specific session data
    sessionData._casSrvCurrent = serverKey;
    sessionData._user = result.user;

    this.log("info", `CAS authentication successful for user ${result.user}`);

    return {
      success: true,
      userId: result.user,
      attributes: result.attributes || {},
      sessionData,
      serverKey,
    };
  }

  /**
   * Build URL to initiate CAS login
   */
  buildLoginUrl(options?: {
    serverKey?: string;
    renew?: boolean;
    gateway?: boolean;
    returnUrl?: string;
  }): string {
    const serverKey = options?.serverKey || this.getDefaultServer();
    if (!serverKey) {
      throw new Error("No CAS server specified");
    }

    const serverConfig = this.config.casSrvMetaDataOptions[serverKey];
    if (!serverConfig) {
      throw new Error(`Unknown CAS server: ${serverKey}`);
    }

    const serverUrl = normalizeCasServerUrl(
      serverConfig.casSrvMetaDataOptions.casSrvMetaDataOptionsUrl,
    );

    const serviceUrl = options?.returnUrl || this.config.serviceUrl;

    // Use server-specific renew/gateway settings if not overridden
    const renew =
      options?.renew ??
      serverConfig.casSrvMetaDataOptions.casSrvMetaDataOptionsRenew;
    const gateway =
      options?.gateway ??
      serverConfig.casSrvMetaDataOptions.casSrvMetaDataOptionsGateway;

    return buildCasLoginUrl(serverUrl, serviceUrl, { renew, gateway });
  }

  /**
   * Build URL to initiate CAS logout
   */
  buildLogoutUrl(options?: { serverKey?: string; returnUrl?: string }): string {
    const serverKey = options?.serverKey || this.getDefaultServer();
    if (!serverKey) {
      throw new Error("No CAS server specified");
    }

    const serverConfig = this.config.casSrvMetaDataOptions[serverKey];
    if (!serverConfig) {
      throw new Error(`Unknown CAS server: ${serverKey}`);
    }

    const serverUrl = normalizeCasServerUrl(
      serverConfig.casSrvMetaDataOptions.casSrvMetaDataOptionsUrl,
    );

    return buildCasLogoutUrl(serverUrl, options?.returnUrl);
  }

  /**
   * Get list of configured CAS servers
   */
  getServerList(): CASServerInfo[] {
    return Object.entries(this.config.casSrvMetaDataOptions).map(
      ([confKey, config]) => ({
        confKey,
        displayName:
          config.casSrvMetaDataOptions.casSrvMetaDataOptionsDisplayName ||
          confKey,
        url: config.casSrvMetaDataOptions.casSrvMetaDataOptionsUrl,
      }),
    );
  }

  /**
   * Get default CAS server
   */
  getDefaultServer(): string | null {
    // Use explicitly configured default
    if (this.config.casSrvDefault) {
      return this.config.casSrvDefault;
    }

    // Use first server if only one configured
    const servers = Object.keys(this.config.casSrvMetaDataOptions);
    if (servers.length === 1) {
      return servers[0];
    }

    return null;
  }

  /**
   * Validate ticket using CAS 2.0 serviceValidate
   */
  private async validateWithServiceValidate(
    serverUrl: string,
    service: string,
    ticket: string,
  ): Promise<
    | { success: true; user: string; attributes?: Record<string, string[]> }
    | { success: false; code: string; message: string }
  > {
    const validateUrl = buildServiceValidateUrl(serverUrl, service, ticket);

    try {
      const response = await this.config.httpClient.get(validateUrl);

      if (response.status !== 200) {
        return {
          success: false,
          code: "HTTP_ERROR",
          message: `HTTP ${response.status}`,
        };
      }

      return parseServiceValidateResponse(response.body);
    } catch (err) {
      this.log("error", `Validation request failed: ${err}`);
      return {
        success: false,
        code: "NETWORK_ERROR",
        message: String(err),
      };
    }
  }

  /**
   * Validate ticket using SAML 1.0 validate
   */
  private async validateWithSaml(
    serverUrl: string,
    service: string,
    ticket: string,
  ): Promise<
    | { success: true; user: string; attributes?: Record<string, string[]> }
    | { success: false; code: string; message: string }
  > {
    const validateUrl = buildSamlValidateUrl(serverUrl, service);

    // Build SAML request
    const samlRequest = this.buildSamlValidateRequest(ticket);

    try {
      const response = await this.config.httpClient.post(
        validateUrl,
        samlRequest,
        "text/xml",
      );

      if (response.status !== 200) {
        return {
          success: false,
          code: "HTTP_ERROR",
          message: `HTTP ${response.status}`,
        };
      }

      return parseSamlValidateResponse(response.body);
    } catch (err) {
      this.log("error", `SAML validation request failed: ${err}`);
      return {
        success: false,
        code: "NETWORK_ERROR",
        message: String(err),
      };
    }
  }

  /**
   * Build SAML validate request
   */
  private buildSamlValidateRequest(ticket: string): string {
    const requestId = `_${Date.now().toString(16)}`;
    const timestamp = new Date().toISOString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <saml1p:Request xmlns:saml1p="urn:oasis:names:tc:SAML:1.0:protocol" RequestID="${requestId}" IssueInstant="${timestamp}" MajorVersion="1" MinorVersion="1">
      <saml1p:AssertionArtifact>${ticket}</saml1p:AssertionArtifact>
    </saml1p:Request>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
  }

  /**
   * Map CAS attributes to session data
   */
  private mapAttributes(
    casAttributes: Record<string, string[]>,
    exportedVars: Record<string, string>,
  ): Record<string, unknown> {
    const sessionData: Record<string, unknown> = {};

    for (const [sessionKey, casAttrName] of Object.entries(exportedVars)) {
      const values = casAttributes[casAttrName];
      if (values && values.length > 0) {
        // Use first value for scalar, or array for multiple values
        sessionData[sessionKey] = values.length === 1 ? values[0] : values;
      }
    }

    return sessionData;
  }

  /**
   * Build service URL from request
   */
  private buildServiceUrl(req: CASAuthRequest): string {
    if (req.url) {
      return extractServiceUrl(req.url);
    }
    return this.config.serviceUrl;
  }

  /**
   * Get query parameter from request
   */
  private getQueryParam(req: CASAuthRequest, name: string): string | null {
    const value = req.query?.[name];
    if (!value) return null;
    return Array.isArray(value) ? value[0] : value;
  }

  /**
   * Logger helper
   */
  private log(
    level: "debug" | "info" | "warn" | "error",
    msg: string,
    ...args: unknown[]
  ): void {
    if (this.config.logger) {
      this.config.logger[level](msg, ...args);
    }
  }
}
