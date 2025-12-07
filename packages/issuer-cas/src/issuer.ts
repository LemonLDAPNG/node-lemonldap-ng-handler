/**
 * CAS Issuer implementation
 */

import {
  generateServiceTicket,
  generateProxyTicket,
  generatePGT,
  generatePGTIOU,
  isValidTicketFormat,
  buildValidateSuccess,
  buildValidateFailure,
  buildServiceValidateSuccess,
  buildServiceValidateError,
  buildProxySuccess,
  buildProxyError,
  buildSamlValidateSuccess,
  buildSamlValidateError,
  buildLogoutRequest,
  parseSamlValidateRequest,
  isServiceUrlValid,
  DEFAULT_TICKET_TTL,
  calculateExpiration,
  isExpired,
  CAS_ERROR_CODES,
  type CASTicket,
  type CASAppConfig,
  type CASLoginResult,
} from "@lemonldap-ng/lib-cas";

import type {
  CASIssuerConfig,
  CASLoginRequest,
  CASLogoutRequest,
  CASValidateRequest,
  CASServiceValidateRequest,
  CASProxyValidateRequest,
  CASProxyRequest,
  CASSamlValidateRequest,
  PortalSessionData,
  CASAppRegistration,
} from "./types";

export class CASIssuer {
  private config: CASIssuerConfig;
  private appRegistrations: Map<string, CASAppRegistration[]> = new Map();

  constructor(config: CASIssuerConfig) {
    this.config = {
      casAccessControlPolicy: "none",
      ticketTTL: DEFAULT_TICKET_TTL,
      ...config,
    };
  }

  async init(): Promise<void> {
    this.log("debug", "CAS Issuer initialized");
  }

  /**
   * Handle CAS login request
   */
  async handleLogin(
    req: CASLoginRequest,
    session: PortalSessionData,
  ): Promise<CASLoginResult> {
    const { service, renew, gateway } = req;

    if (!service) {
      return {
        type: "error",
        code: CAS_ERROR_CODES.INVALID_REQUEST,
        message: "Missing service parameter",
      };
    }

    // Find application by service URL
    const app = this.getAppByService(service);

    // Check access control policy
    if (!app) {
      if (this.config.casAccessControlPolicy === "error") {
        return {
          type: "error",
          code: CAS_ERROR_CODES.INVALID_SERVICE,
          message: "Service not registered",
        };
      }

      // Policy "faketicket" or "none" - allow the request
      if (this.config.casAccessControlPolicy === "faketicket") {
        // Generate a fake ticket that will fail validation
        const fakeTicket = `ST-fake-${Date.now()}`;
        const redirectUrl = this.buildRedirectUrl(service, fakeTicket);
        return { type: "redirect", url: redirectUrl };
      }
    }

    // Check authentication level if required
    if (app) {
      const requiredLevel =
        app.casAppMetaDataOptions.casAppMetaDataOptionsAuthnLevel;
      if (requiredLevel && (session._authLevel || 0) < requiredLevel) {
        return { type: "upgrade", targetLevel: requiredLevel };
      }

      // Check access rule (simplified - in real impl would evaluate rule)
      const rule = app.casAppMetaDataOptions.casAppMetaDataOptionsRule;
      if (rule && rule !== "accept") {
        // Rule evaluation would go here
        this.log("debug", `Access rule for app: ${rule}`);
      }
    }

    // Gateway mode: if not authenticated, redirect back without ticket
    if (gateway && !session._user) {
      return { type: "gateway", url: service };
    }

    // Generate Service Ticket
    const ticket = generateServiceTicket();
    const ticketData: CASTicket = {
      id: ticket,
      type: "ST",
      service,
      userId: session._user,
      primarySessionId: session._session_id,
      createdAt: Date.now(),
      expiresAt: calculateExpiration(
        this.config.ticketTTL?.ST || DEFAULT_TICKET_TTL.ST,
      ),
      renew: renew || false,
    };

    await this.config.ticketStore.set(ticket, ticketData);

    // Register app for SLO
    if (app) {
      this.registerAppForSession(session._session_id, {
        confKey: this.getAppConfKey(app),
        service,
        sessionId: session._session_id,
        ticketId: ticket,
      });
    }

    this.log(
      "info",
      `Generated ST ${ticket} for user ${session._user} to service ${service}`,
    );

    const redirectUrl = this.buildRedirectUrl(service, ticket);
    return { type: "redirect", url: redirectUrl };
  }

  /**
   * Handle CAS logout request
   */
  async handleLogout(
    req: CASLogoutRequest,
    sessionId: string,
  ): Promise<{ redirectUrl?: string }> {
    const { service, url } = req;
    const redirectUrl = service || url;

    // Get registered apps for this session
    const apps = this.appRegistrations.get(sessionId) || [];

    if (apps.length > 0) {
      // Send SLO requests to apps with logout enabled
      await this.sendLogoutRequests(sessionId, apps);

      // Clear registrations
      this.appRegistrations.delete(sessionId);

      // Notify portal about logout
      if (this.config.onLogout) {
        await this.config.onLogout(
          sessionId,
          apps.map((a) => a.confKey),
        );
      }
    }

    this.log(
      "info",
      `Logout for session ${sessionId}, notified ${apps.length} apps`,
    );

    return { redirectUrl };
  }

  /**
   * Handle CAS 1.0 validate request
   */
  async handleValidate(req: CASValidateRequest): Promise<string> {
    const { service, ticket, renew } = req;

    if (!service || !ticket) {
      return buildValidateFailure();
    }

    // Validate ticket format
    if (!isValidTicketFormat(ticket, "ST")) {
      return buildValidateFailure();
    }

    // Get and validate ticket
    const ticketData = await this.config.ticketStore.get(ticket);
    if (!ticketData) {
      this.log("debug", `Ticket ${ticket} not found`);
      return buildValidateFailure();
    }

    // Delete ticket (one-time use)
    await this.config.ticketStore.delete(ticket);

    // Check expiration
    if (isExpired(ticketData.expiresAt)) {
      this.log("debug", `Ticket ${ticket} expired`);
      return buildValidateFailure();
    }

    // Check service match
    if (!this.serviceMatches(ticketData.service, service)) {
      this.log(
        "debug",
        `Service mismatch: expected ${ticketData.service}, got ${service}`,
      );
      return buildValidateFailure();
    }

    // Check renew flag
    if (renew && !ticketData.renew) {
      this.log("debug", "Renew required but ticket was not issued with renew");
      return buildValidateFailure();
    }

    this.log(
      "info",
      `Validated ticket ${ticket} for user ${ticketData.userId}`,
    );
    return buildValidateSuccess(ticketData.userId);
  }

  /**
   * Handle CAS 2.0/3.0 serviceValidate request
   */
  async handleServiceValidate(req: CASServiceValidateRequest): Promise<string> {
    const { service, ticket, pgtUrl, renew } = req;

    if (!service || !ticket) {
      return buildServiceValidateError(
        CAS_ERROR_CODES.INVALID_REQUEST,
        "Missing required parameters",
      );
    }

    // Validate ticket format
    if (!isValidTicketFormat(ticket, "ST")) {
      return buildServiceValidateError(
        CAS_ERROR_CODES.INVALID_TICKET_SPEC,
        "Invalid ticket format",
      );
    }

    // Get and validate ticket
    const ticketData = await this.config.ticketStore.get(ticket);
    if (!ticketData) {
      return buildServiceValidateError(
        CAS_ERROR_CODES.INVALID_TICKET,
        "Ticket not found",
      );
    }

    // Delete ticket (one-time use)
    await this.config.ticketStore.delete(ticket);

    // Check expiration
    if (isExpired(ticketData.expiresAt)) {
      return buildServiceValidateError(
        CAS_ERROR_CODES.INVALID_TICKET,
        "Ticket expired",
      );
    }

    // Check service match
    if (!this.serviceMatches(ticketData.service, service)) {
      return buildServiceValidateError(
        CAS_ERROR_CODES.INVALID_SERVICE,
        "Service mismatch",
      );
    }

    // Check renew flag
    if (renew && !ticketData.renew) {
      return buildServiceValidateError(
        CAS_ERROR_CODES.INVALID_TICKET,
        "Ticket was not issued with renew",
      );
    }

    // Get attributes for the app
    const app = this.getAppByService(service);
    const attributes = await this.getAttributesForApp(
      ticketData.primarySessionId,
      app,
    );

    // Handle PGT request
    let pgtIou: string | undefined;
    if (pgtUrl && app?.casAppMetaDataOptions.casAppMetaDataOptionsAllowProxy) {
      pgtIou = await this.issuePGT(ticketData, pgtUrl);
    }

    this.log(
      "info",
      `ServiceValidate: ticket ${ticket} validated for user ${ticketData.userId}`,
    );

    return buildServiceValidateSuccess(ticketData.userId, attributes, pgtIou);
  }

  /**
   * Handle CAS 2.0/3.0 proxyValidate request
   */
  async handleProxyValidate(req: CASProxyValidateRequest): Promise<string> {
    const { service, ticket, pgtUrl } = req;

    if (!service || !ticket) {
      return buildServiceValidateError(
        CAS_ERROR_CODES.INVALID_REQUEST,
        "Missing required parameters",
      );
    }

    // Validate ticket format (ST or PT)
    const ticketType = ticket.startsWith("ST-")
      ? "ST"
      : ticket.startsWith("PT-")
        ? "PT"
        : null;
    if (!ticketType) {
      return buildServiceValidateError(
        CAS_ERROR_CODES.INVALID_TICKET_SPEC,
        "Invalid ticket format",
      );
    }

    // Get and validate ticket
    const ticketData = await this.config.ticketStore.get(ticket);
    if (!ticketData) {
      return buildServiceValidateError(
        CAS_ERROR_CODES.INVALID_TICKET,
        "Ticket not found",
      );
    }

    // Delete ticket (one-time use)
    await this.config.ticketStore.delete(ticket);

    // Check expiration
    if (isExpired(ticketData.expiresAt)) {
      return buildServiceValidateError(
        CAS_ERROR_CODES.INVALID_TICKET,
        "Ticket expired",
      );
    }

    // Check service match
    if (!this.serviceMatches(ticketData.service, service)) {
      return buildServiceValidateError(
        CAS_ERROR_CODES.INVALID_SERVICE,
        "Service mismatch",
      );
    }

    // Get attributes
    const app = this.getAppByService(service);
    const attributes = await this.getAttributesForApp(
      ticketData.primarySessionId,
      app,
    );

    // Handle PGT request
    let pgtIou: string | undefined;
    if (pgtUrl && app?.casAppMetaDataOptions.casAppMetaDataOptionsAllowProxy) {
      pgtIou = await this.issuePGT(ticketData, pgtUrl);
    }

    this.log(
      "info",
      `ProxyValidate: ticket ${ticket} validated for user ${ticketData.userId}`,
    );

    return buildServiceValidateSuccess(
      ticketData.userId,
      attributes,
      pgtIou,
      ticketData.proxies,
    );
  }

  /**
   * Handle CAS proxy request
   */
  async handleProxy(req: CASProxyRequest): Promise<string> {
    const { pgt, targetService } = req;

    if (!pgt || !targetService) {
      return buildProxyError(
        CAS_ERROR_CODES.INVALID_REQUEST,
        "Missing required parameters",
      );
    }

    // Get PGT
    const pgtData = await this.config.ticketStore.get(pgt);
    if (!pgtData || pgtData.type !== "PGT") {
      return buildProxyError(
        CAS_ERROR_CODES.INVALID_TICKET,
        "PGT not found or invalid",
      );
    }

    // Check expiration
    if (isExpired(pgtData.expiresAt)) {
      return buildProxyError(CAS_ERROR_CODES.INVALID_TICKET, "PGT expired");
    }

    // Check if target service allows proxy
    const app = this.getAppByService(targetService);
    if (app && !app.casAppMetaDataOptions.casAppMetaDataOptionsAllowProxy) {
      return buildProxyError(
        CAS_ERROR_CODES.UNAUTHORIZED_SERVICE_PROXY,
        "Service does not accept proxy tickets",
      );
    }

    // Generate proxy ticket
    const pt = generateProxyTicket();
    const ptData: CASTicket = {
      id: pt,
      type: "PT",
      service: targetService,
      userId: pgtData.userId,
      primarySessionId: pgtData.primarySessionId,
      createdAt: Date.now(),
      expiresAt: calculateExpiration(
        this.config.ticketTTL?.PT || DEFAULT_TICKET_TTL.PT,
      ),
      proxies: [...(pgtData.proxies || []), pgtData.service],
      pgtId: pgt,
    };

    await this.config.ticketStore.set(pt, ptData);

    this.log("info", `Issued PT ${pt} for service ${targetService}`);

    return buildProxySuccess(pt);
  }

  /**
   * Handle SAML validate request
   */
  async handleSamlValidate(req: CASSamlValidateRequest): Promise<string> {
    const { TARGET: service, body } = req;

    // Parse SAML request
    const samlReq = parseSamlValidateRequest(body);
    if (!samlReq) {
      return buildSamlValidateError(
        CAS_ERROR_CODES.INVALID_REQUEST,
        "Invalid SAML request",
      );
    }

    const { ticket, requestId } = samlReq;

    // Validate ticket
    if (!isValidTicketFormat(ticket, "ST")) {
      return buildSamlValidateError(
        CAS_ERROR_CODES.INVALID_TICKET_SPEC,
        "Invalid ticket format",
        requestId,
      );
    }

    // Get and validate ticket
    const ticketData = await this.config.ticketStore.get(ticket);
    if (!ticketData) {
      return buildSamlValidateError(
        CAS_ERROR_CODES.INVALID_TICKET,
        "Ticket not found",
        requestId,
      );
    }

    // Delete ticket (one-time use)
    await this.config.ticketStore.delete(ticket);

    // Check expiration
    if (isExpired(ticketData.expiresAt)) {
      return buildSamlValidateError(
        CAS_ERROR_CODES.INVALID_TICKET,
        "Ticket expired",
        requestId,
      );
    }

    // Check service match
    if (!this.serviceMatches(ticketData.service, service)) {
      return buildSamlValidateError(
        CAS_ERROR_CODES.INVALID_SERVICE,
        "Service mismatch",
        requestId,
      );
    }

    // Get attributes
    const app = this.getAppByService(service);
    const attributes = await this.getAttributesForApp(
      ticketData.primarySessionId,
      app,
    );

    this.log(
      "info",
      `SamlValidate: ticket ${ticket} validated for user ${ticketData.userId}`,
    );

    return buildSamlValidateSuccess(ticketData.userId, attributes, requestId);
  }

  /**
   * Send logout requests to registered apps (SLO)
   */
  private async sendLogoutRequests(
    sessionId: string,
    apps: CASAppRegistration[],
  ): Promise<void> {
    if (!this.config.httpClient) {
      this.log("warn", "No HTTP client configured for SLO");
      return;
    }

    const logoutXml = buildLogoutRequest(sessionId);

    for (const app of apps) {
      const appConfig = this.config.casAppMetaDataOptions[app.confKey];
      if (appConfig?.casAppMetaDataOptions.casAppMetaDataOptionsLogout === 1) {
        try {
          await this.config.httpClient.get(
            `${app.service}?logoutRequest=${encodeURIComponent(logoutXml)}`,
          );
          this.log("debug", `SLO request sent to ${app.service}`);
        } catch (err) {
          this.log("warn", `SLO request failed for ${app.service}: ${err}`);
        }
      }
    }
  }

  /**
   * Issue a Proxy Granting Ticket
   */
  private async issuePGT(
    ticketData: CASTicket,
    pgtUrl: string,
  ): Promise<string | undefined> {
    if (!this.config.httpClient || !this.config.pgtIOUStore) {
      this.log("warn", "PGT issuance requires HTTP client and PGTIOU store");
      return undefined;
    }

    // Validate pgtUrl (must be HTTPS)
    if (!pgtUrl.startsWith("https://")) {
      this.log("warn", `Invalid pgtUrl (not HTTPS): ${pgtUrl}`);
      return undefined;
    }

    // Generate PGT and PGTIOU
    const pgt = generatePGT();
    const pgtiou = generatePGTIOU();

    // Store PGT
    const pgtData: CASTicket = {
      id: pgt,
      type: "PGT",
      service: ticketData.service,
      userId: ticketData.userId,
      primarySessionId: ticketData.primarySessionId,
      createdAt: Date.now(),
      expiresAt: calculateExpiration(
        this.config.ticketTTL?.PGT || DEFAULT_TICKET_TTL.PGT,
      ),
    };
    await this.config.ticketStore.set(pgt, pgtData);

    // Store PGTIOU -> PGT mapping
    await this.config.pgtIOUStore.set(pgtiou, pgt);

    // Callback to pgtUrl with PGTIOU and PGT
    try {
      const callbackUrl = `${pgtUrl}${pgtUrl.includes("?") ? "&" : "?"}pgtIou=${pgtiou}&pgtId=${pgt}`;
      const response = await this.config.httpClient.get(callbackUrl);

      if (response.status >= 200 && response.status < 300) {
        this.log("debug", `PGT callback successful to ${pgtUrl}`);
        return pgtiou;
      } else {
        this.log("warn", `PGT callback failed with status ${response.status}`);
        // Clean up
        await this.config.ticketStore.delete(pgt);
        await this.config.pgtIOUStore.delete(pgtiou);
        return undefined;
      }
    } catch (err) {
      this.log("warn", `PGT callback failed: ${err}`);
      // Clean up
      await this.config.ticketStore.delete(pgt);
      await this.config.pgtIOUStore.delete(pgtiou);
      return undefined;
    }
  }

  /**
   * Get attributes for an application from session
   */
  private async getAttributesForApp(
    sessionId: string,
    app: CASAppConfig | null,
  ): Promise<Record<string, string[]>> {
    const session = await this.config.getSession(sessionId);
    if (!session) {
      return {};
    }

    const attributes: Record<string, string[]> = {};

    if (app?.casAppMetaDataExportedVars) {
      for (const [casAttr, sessionKey] of Object.entries(
        app.casAppMetaDataExportedVars,
      )) {
        const value = session[sessionKey];
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            attributes[casAttr] = value.map(String);
          } else {
            attributes[casAttr] = [String(value)];
          }
        }
      }
    }

    return attributes;
  }

  /**
   * Find application by service URL
   */
  private getAppByService(serviceUrl: string): CASAppConfig | null {
    for (const [_confKey, app] of Object.entries(
      this.config.casAppMetaDataOptions,
    )) {
      const pattern = app.casAppMetaDataOptions.casAppMetaDataOptionsService;
      if (isServiceUrlValid(serviceUrl, [pattern])) {
        return app;
      }
    }
    return null;
  }

  /**
   * Get app confKey
   */
  private getAppConfKey(app: CASAppConfig): string {
    for (const [confKey, a] of Object.entries(
      this.config.casAppMetaDataOptions,
    )) {
      if (a === app) {
        return confKey;
      }
    }
    return "unknown";
  }

  /**
   * Check if two service URLs match
   */
  private serviceMatches(expected: string, actual: string): boolean {
    // Normalize URLs for comparison
    const normalize = (url: string) => url.replace(/\/$/, "");
    return normalize(expected) === normalize(actual);
  }

  /**
   * Build redirect URL with ticket
   */
  private buildRedirectUrl(service: string, ticket: string): string {
    const separator = service.includes("?") ? "&" : "?";
    return `${service}${separator}ticket=${ticket}`;
  }

  /**
   * Register app for SLO
   */
  private registerAppForSession(
    sessionId: string,
    reg: CASAppRegistration,
  ): void {
    const existing = this.appRegistrations.get(sessionId) || [];
    // Avoid duplicates
    if (!existing.find((r) => r.service === reg.service)) {
      existing.push(reg);
      this.appRegistrations.set(sessionId, existing);
    }
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
