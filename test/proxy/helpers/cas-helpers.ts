/**
 * CAS helpers for proxy integration tests
 */

/**
 * Build CAS login URL
 */
export function buildCASLoginUrl(
  serverUrl: string,
  service: string,
  options?: {
    renew?: boolean;
    gateway?: boolean;
  },
): string {
  const params = new URLSearchParams({
    service,
  });

  if (options?.renew) {
    params.set("renew", "true");
  }

  if (options?.gateway) {
    params.set("gateway", "true");
  }

  return `${serverUrl}/cas/login?${params.toString()}`;
}

/**
 * Build CAS logout URL
 */
export function buildCASLogoutUrl(serverUrl: string, service?: string): string {
  if (service) {
    return `${serverUrl}/cas/logout?service=${encodeURIComponent(service)}`;
  }
  return `${serverUrl}/cas/logout`;
}

/**
 * Extract ticket from URL
 */
export function extractTicket(url: string): string | null {
  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.searchParams.get("ticket");
  } catch {
    return null;
  }
}

/**
 * Parse CAS serviceValidate response
 */
export function parseServiceValidateResponse(xml: string): {
  success: boolean;
  user?: string;
  attributes?: Record<string, string[]>;
  pgtIou?: string;
  error?: { code: string; message: string };
} {
  if (!xml) {
    return {
      success: false,
      error: { code: "INVALID_RESPONSE", message: "Empty response" },
    };
  }

  // Check for error
  const errorMatch = xml.match(
    /<cas:authenticationFailure[^>]*code="([^"]*)"[^>]*>([^<]*)</i,
  );
  if (errorMatch) {
    return {
      success: false,
      error: {
        code: errorMatch[1],
        message: errorMatch[2].trim(),
      },
    };
  }

  // Check for success
  const userMatch = xml.match(/<cas:user>([^<]*)<\/cas:user>/i);
  if (!userMatch) {
    return {
      success: false,
      error: { code: "INVALID_RESPONSE", message: "No user in response" },
    };
  }

  const user = userMatch[1].trim();
  const attributes: Record<string, string[]> = {};

  // Extract attributes
  const attrsMatch = xml.match(/<cas:attributes>([^]*?)<\/cas:attributes>/i);
  if (attrsMatch) {
    const attrPattern = /<cas:([^>]+)>([^<]*)<\/cas:\1>/gi;
    let match;
    while ((match = attrPattern.exec(attrsMatch[1])) !== null) {
      const key = match[1];
      const value = match[2].trim();
      if (!attributes[key]) {
        attributes[key] = [];
      }
      attributes[key].push(value);
    }
  }

  // Extract PGTIOU
  const pgtIouMatch = xml.match(
    /<cas:proxyGrantingTicket>([^<]*)<\/cas:proxyGrantingTicket>/i,
  );
  const pgtIou = pgtIouMatch ? pgtIouMatch[1].trim() : undefined;

  return {
    success: true,
    user,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    pgtIou,
  };
}

/**
 * Parse CAS 1.0 validate response
 */
export function parseValidateResponse(response: string): {
  success: boolean;
  user?: string;
} {
  if (!response) {
    return { success: false };
  }

  const lines = response.trim().split("\n");
  if (lines[0] === "yes" && lines[1]) {
    return { success: true, user: lines[1].trim() };
  }

  return { success: false };
}

/**
 * CAS server configuration for tests
 */
export interface CASServerConfig {
  serverUrl: string;
  exportedVars?: Record<string, string>;
  gateway?: boolean;
  renew?: boolean;
}

/**
 * CAS issuer configuration for tests
 */
export interface CASIssuerConfig {
  accessControlPolicy?: "none" | "error" | "faketicket";
  casAttr?: string;
  casAttributes?: Record<string, string>;
}

/**
 * Create CAS client (auth) configuration
 */
export function createCASClientConfig(
  confKey: string,
  serverUrl: string,
  config: CASServerConfig = { serverUrl },
): Record<string, unknown> {
  return {
    casSrvMetaDataOptions: {
      [confKey]: {
        casSrvMetaDataOptionsUrl: serverUrl,
        casSrvMetaDataOptionsGateway: config.gateway ? 1 : 0,
        casSrvMetaDataOptionsRenew: config.renew ? 1 : 0,
      },
    },
    casSrvMetaDataExportedVars: {
      [confKey]: config.exportedVars || {
        cn: "cn",
        mail: "mail",
        uid: "uid",
      },
    },
  };
}

/**
 * Create CAS issuer configuration
 */
export function createCASIssuerConfig(
  config: CASIssuerConfig = {},
): Record<string, unknown> {
  return {
    issuerDBCASActivation: true,
    casAccessControlPolicy: config.accessControlPolicy || "none",
    casAttr: config.casAttr || "uid",
    casAttributes: config.casAttributes || {
      cn: "cn",
      mail: "mail",
      uid: "uid",
    },
  };
}

/**
 * Build SAML validate request for CAS
 */
export function buildSamlValidateRequest(
  ticket: string,
  requestId?: string,
): string {
  const id =
    requestId ||
    `_${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const timestamp = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <saml1p:Request xmlns:saml1p="urn:oasis:names:tc:SAML:1.0:protocol" RequestID="${id}" IssueInstant="${timestamp}" MajorVersion="1" MinorVersion="1">
      <saml1p:AssertionArtifact>${ticket}</saml1p:AssertionArtifact>
    </saml1p:Request>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

/**
 * Parse SAML validate response for CAS
 */
export function parseSamlValidateResponse(xml: string): {
  success: boolean;
  user?: string;
  attributes?: Record<string, string[]>;
  error?: { code: string; message: string };
} {
  if (!xml) {
    return {
      success: false,
      error: { code: "INVALID_RESPONSE", message: "Empty response" },
    };
  }

  // Check for error
  if (xml.includes("RequestDenied") || xml.includes("Responder")) {
    const messageMatch = xml.match(/<saml1p:StatusMessage>([^<]*)</i);
    return {
      success: false,
      error: {
        code: "REQUEST_DENIED",
        message: messageMatch ? messageMatch[1] : "Request denied",
      },
    };
  }

  // Check for success
  if (!xml.includes("Success")) {
    return {
      success: false,
      error: { code: "INVALID_RESPONSE", message: "Unexpected status" },
    };
  }

  // Extract user
  const userMatch = xml.match(
    /<saml1:NameIdentifier>([^<]*)<\/saml1:NameIdentifier>/i,
  );
  if (!userMatch) {
    return {
      success: false,
      error: { code: "INVALID_RESPONSE", message: "No user in response" },
    };
  }

  const user = userMatch[1].trim();
  const attributes: Record<string, string[]> = {};

  // Extract attributes
  const attrPattern =
    /<saml1:Attribute[^>]*AttributeName="([^"]*)"[^>]*>([^]*?)<\/saml1:Attribute>/gi;
  let attrMatch;
  while ((attrMatch = attrPattern.exec(xml)) !== null) {
    const key = attrMatch[1];
    const valuePattern =
      /<saml1:AttributeValue>([^<]*)<\/saml1:AttributeValue>/gi;
    let valueMatch;
    while ((valueMatch = valuePattern.exec(attrMatch[2])) !== null) {
      if (!attributes[key]) {
        attributes[key] = [];
      }
      attributes[key].push(valueMatch[1].trim());
    }
  }

  return {
    success: true,
    user,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
  };
}
