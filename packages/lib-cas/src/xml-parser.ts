/**
 * CAS XML parsing utilities
 */

import { SAMLValidateRequest, CASValidateResult } from "./types";

/**
 * Simple XML tag extraction (without full XML parser dependency)
 */
function extractTagContent(xml: string, tagName: string): string | null {
  // Handle namespaced tags (e.g., saml1p:AssertionArtifact)
  const patterns = [
    new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, "i"),
    new RegExp(`<[^:]+:${tagName}[^>]*>([^<]*)</[^:]+:${tagName}>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Extract attribute value from XML tag
 */
function extractAttribute(
  xml: string,
  tagName: string,
  attrName: string,
): string | null {
  const patterns = [
    new RegExp(`<${tagName}[^>]*\\s${attrName}="([^"]*)"`, "i"),
    new RegExp(`<[^:]+:${tagName}[^>]*\\s${attrName}="([^"]*)"`, "i"),
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

/**
 * Parse SAML validate request (SOAP envelope with SAML 1.0 Request)
 *
 * Expected format:
 * <SOAP-ENV:Envelope>
 *   <SOAP-ENV:Body>
 *     <saml1p:Request>
 *       <saml1p:AssertionArtifact>ST-xxx</saml1p:AssertionArtifact>
 *     </saml1p:Request>
 *   </SOAP-ENV:Body>
 * </SOAP-ENV:Envelope>
 */
export function parseSamlValidateRequest(
  xml: string,
): SAMLValidateRequest | null {
  if (!xml) return null;

  // Extract ticket from AssertionArtifact
  const ticket = extractTagContent(xml, "AssertionArtifact");
  if (!ticket) return null;

  // Extract optional RequestID
  const requestId = extractAttribute(xml, "Request", "RequestID");

  // Extract optional IssueInstant
  const issueInstant = extractAttribute(xml, "Request", "IssueInstant");

  return {
    ticket,
    requestId: requestId || undefined,
    issueInstant: issueInstant || undefined,
  };
}

/**
 * Unescape XML entities
 */
function unescapeXml(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Parse CAS serviceValidate response
 */
export function parseServiceValidateResponse(xml: string): CASValidateResult {
  if (!xml) {
    return {
      success: false,
      code: "INVALID_RESPONSE",
      message: "Empty response",
    };
  }

  // Check for error response
  const errorMatch = xml.match(
    /<cas:authenticationFailure[^>]*code="([^"]*)"[^>]*>([^<]*)</i,
  );
  if (errorMatch) {
    return {
      success: false,
      code: errorMatch[1],
      message: unescapeXml(errorMatch[2].trim()),
    };
  }

  // Check for success response
  const userMatch = xml.match(/<cas:user>([^<]*)<\/cas:user>/i);
  if (!userMatch) {
    return {
      success: false,
      code: "INVALID_RESPONSE",
      message: "No user found in response",
    };
  }

  const user = unescapeXml(userMatch[1].trim());

  // Extract attributes
  const attributes: Record<string, string[]> = {};
  const attrsMatch = xml.match(/<cas:attributes>([\s\S]*?)<\/cas:attributes>/i);
  if (attrsMatch) {
    const attrsXml = attrsMatch[1];
    const attrPattern = /<cas:([^>]+)>([^<]*)<\/cas:\1>/gi;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(attrsXml)) !== null) {
      const key = attrMatch[1];
      const value = unescapeXml(attrMatch[2].trim());
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
  const pgtIou = pgtIouMatch ? unescapeXml(pgtIouMatch[1].trim()) : undefined;

  // Extract proxies
  const proxies: string[] = [];
  const proxiesMatch = xml.match(/<cas:proxies>([\s\S]*?)<\/cas:proxies>/i);
  if (proxiesMatch) {
    const proxyPattern = /<cas:proxy>([^<]*)<\/cas:proxy>/gi;
    let proxyMatch;
    while ((proxyMatch = proxyPattern.exec(proxiesMatch[1])) !== null) {
      proxies.push(unescapeXml(proxyMatch[1].trim()));
    }
  }

  return {
    success: true,
    user,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    pgtIou,
    proxies: proxies.length > 0 ? proxies : undefined,
  };
}

/**
 * Parse CAS 1.0 validate response (plain text)
 * Format: yes\nusername\n or no\n\n
 */
export function parseValidateResponse(response: string): CASValidateResult {
  if (!response) {
    return {
      success: false,
      code: "INVALID_RESPONSE",
      message: "Empty response",
    };
  }

  const lines = response.trim().split("\n");
  if (lines[0] === "yes" && lines[1]) {
    return { success: true, user: lines[1].trim() };
  }

  return {
    success: false,
    code: "INVALID_TICKET",
    message: "Authentication failed",
  };
}

/**
 * Parse SAML validate response (for CAS SP)
 */
export function parseSamlValidateResponse(xml: string): CASValidateResult {
  if (!xml) {
    return {
      success: false,
      code: "INVALID_RESPONSE",
      message: "Empty response",
    };
  }

  // Check for error status
  if (xml.includes("RequestDenied") || xml.includes("Responder")) {
    const messageMatch = xml.match(/<saml1p:StatusMessage>([^<]*)</i);
    return {
      success: false,
      code: "REQUEST_DENIED",
      message: messageMatch ? unescapeXml(messageMatch[1]) : "Request denied",
    };
  }

  // Check for success
  if (!xml.includes("Success")) {
    return {
      success: false,
      code: "INVALID_RESPONSE",
      message: "Unexpected response status",
    };
  }

  // Extract user from NameIdentifier
  const userMatch = xml.match(
    /<saml1:NameIdentifier>([^<]*)<\/saml1:NameIdentifier>/i,
  );
  if (!userMatch) {
    return {
      success: false,
      code: "INVALID_RESPONSE",
      message: "No user found in response",
    };
  }

  const user = unescapeXml(userMatch[1].trim());

  // Extract attributes
  const attributes: Record<string, string[]> = {};
  const attrPattern =
    /<saml1:Attribute[^>]*AttributeName="([^"]*)"[^>]*>([\s\S]*?)<\/saml1:Attribute>/gi;
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
      attributes[key].push(unescapeXml(valueMatch[1].trim()));
    }
  }

  return {
    success: true,
    user,
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
  };
}

/**
 * Parse CAS proxy response
 */
export function parseProxyResponse(
  xml: string,
):
  | { success: true; proxyTicket: string }
  | { success: false; code: string; message: string } {
  if (!xml) {
    return {
      success: false,
      code: "INVALID_RESPONSE",
      message: "Empty response",
    };
  }

  // Check for error
  const errorMatch = xml.match(
    /<cas:proxyFailure[^>]*code="([^"]*)"[^>]*>([^<]*)</i,
  );
  if (errorMatch) {
    return {
      success: false,
      code: errorMatch[1],
      message: unescapeXml(errorMatch[2].trim()),
    };
  }

  // Check for success
  const ticketMatch = xml.match(/<cas:proxyTicket>([^<]*)<\/cas:proxyTicket>/i);
  if (!ticketMatch) {
    return {
      success: false,
      code: "INVALID_RESPONSE",
      message: "No proxy ticket found",
    };
  }

  return {
    success: true,
    proxyTicket: unescapeXml(ticketMatch[1].trim()),
  };
}
