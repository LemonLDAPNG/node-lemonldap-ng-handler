/**
 * CAS XML response builders
 */

const CAS_NS = "http://www.yale.edu/tp/cas";
const SAML_NS = "urn:oasis:names:tc:SAML:1.0:protocol";
const SAML_ASSERTION_NS = "urn:oasis:names:tc:SAML:1.0:assertion";

/**
 * Escape XML special characters
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build CAS 1.0 validate success response (plain text)
 */
export function buildValidateSuccess(user: string): string {
  return `yes\n${user}\n`;
}

/**
 * Build CAS 1.0 validate failure response (plain text)
 */
export function buildValidateFailure(): string {
  return "no\n\n";
}

/**
 * Build CAS 2.0/3.0 serviceValidate success response (XML)
 */
export function buildServiceValidateSuccess(
  user: string,
  attributes?: Record<string, string[]>,
  pgtIou?: string,
  proxies?: string[],
): string {
  let xml = `<cas:serviceResponse xmlns:cas="${CAS_NS}">
  <cas:authenticationSuccess>
    <cas:user>${escapeXml(user)}</cas:user>`;

  if (attributes && Object.keys(attributes).length > 0) {
    xml += `
    <cas:attributes>`;
    for (const [key, values] of Object.entries(attributes)) {
      for (const value of values) {
        xml += `
      <cas:${escapeXml(key)}>${escapeXml(value)}</cas:${escapeXml(key)}>`;
      }
    }
    xml += `
    </cas:attributes>`;
  }

  if (pgtIou) {
    xml += `
    <cas:proxyGrantingTicket>${escapeXml(pgtIou)}</cas:proxyGrantingTicket>`;
  }

  if (proxies && proxies.length > 0) {
    xml += `
    <cas:proxies>`;
    for (const proxy of proxies) {
      xml += `
      <cas:proxy>${escapeXml(proxy)}</cas:proxy>`;
    }
    xml += `
    </cas:proxies>`;
  }

  xml += `
  </cas:authenticationSuccess>
</cas:serviceResponse>`;

  return xml;
}

/**
 * Build CAS 2.0/3.0 serviceValidate error response (XML)
 */
export function buildServiceValidateError(
  code: string,
  message: string,
): string {
  return `<cas:serviceResponse xmlns:cas="${CAS_NS}">
  <cas:authenticationFailure code="${escapeXml(code)}">${escapeXml(message)}</cas:authenticationFailure>
</cas:serviceResponse>`;
}

/**
 * Build CAS 2.0 proxy success response (XML)
 */
export function buildProxySuccess(proxyTicket: string): string {
  return `<cas:serviceResponse xmlns:cas="${CAS_NS}">
  <cas:proxySuccess>
    <cas:proxyTicket>${escapeXml(proxyTicket)}</cas:proxyTicket>
  </cas:proxySuccess>
</cas:serviceResponse>`;
}

/**
 * Build CAS 2.0 proxy error response (XML)
 */
export function buildProxyError(code: string, message: string): string {
  return `<cas:serviceResponse xmlns:cas="${CAS_NS}">
  <cas:proxyFailure code="${escapeXml(code)}">${escapeXml(message)}</cas:proxyFailure>
</cas:serviceResponse>`;
}

/**
 * Generate ISO 8601 timestamp
 */
function generateTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Generate a unique SAML ID
 */
function generateSamlId(): string {
  return `_${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

/**
 * Build SAML 1.0 validate success response (for samlValidate endpoint)
 */
export function buildSamlValidateSuccess(
  user: string,
  attributes: Record<string, string[]>,
  requestId?: string,
): string {
  const responseId = generateSamlId();
  const assertionId = generateSamlId();
  const timestamp = generateTimestamp();
  const inResponseTo = requestId
    ? ` InResponseTo="${escapeXml(requestId)}"`
    : "";

  let attributeStatements = "";
  if (attributes && Object.keys(attributes).length > 0) {
    attributeStatements = `
      <saml1:AttributeStatement>
        <saml1:Subject>
          <saml1:NameIdentifier>${escapeXml(user)}</saml1:NameIdentifier>
        </saml1:Subject>`;
    for (const [key, values] of Object.entries(attributes)) {
      attributeStatements += `
        <saml1:Attribute AttributeName="${escapeXml(key)}" AttributeNamespace="http://www.ja-sig.org/products/cas/">`;
      for (const value of values) {
        attributeStatements += `
          <saml1:AttributeValue>${escapeXml(value)}</saml1:AttributeValue>`;
      }
      attributeStatements += `
        </saml1:Attribute>`;
    }
    attributeStatements += `
      </saml1:AttributeStatement>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <saml1p:Response xmlns:saml1p="${SAML_NS}" IssueInstant="${timestamp}" MajorVersion="1" MinorVersion="1" ResponseID="${responseId}"${inResponseTo}>
      <saml1p:Status>
        <saml1p:StatusCode Value="saml1p:Success"/>
      </saml1p:Status>
      <saml1:Assertion xmlns:saml1="${SAML_ASSERTION_NS}" AssertionID="${assertionId}" IssueInstant="${timestamp}" MajorVersion="1" MinorVersion="1">
        <saml1:Conditions NotBefore="${timestamp}" NotOnOrAfter="${timestamp}"/>
        <saml1:AuthenticationStatement AuthenticationInstant="${timestamp}" AuthenticationMethod="urn:oasis:names:tc:SAML:1.0:am:password">
          <saml1:Subject>
            <saml1:NameIdentifier>${escapeXml(user)}</saml1:NameIdentifier>
          </saml1:Subject>
        </saml1:AuthenticationStatement>${attributeStatements}
      </saml1:Assertion>
    </saml1p:Response>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

/**
 * Build SAML 1.0 validate error response
 */
export function buildSamlValidateError(
  code: string,
  message: string,
  requestId?: string,
): string {
  const responseId = generateSamlId();
  const timestamp = generateTimestamp();
  const inResponseTo = requestId
    ? ` InResponseTo="${escapeXml(requestId)}"`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <saml1p:Response xmlns:saml1p="${SAML_NS}" IssueInstant="${timestamp}" MajorVersion="1" MinorVersion="1" ResponseID="${responseId}"${inResponseTo}>
      <saml1p:Status>
        <saml1p:StatusCode Value="saml1p:RequestDenied"/>
        <saml1p:StatusMessage>${escapeXml(code)}: ${escapeXml(message)}</saml1p:StatusMessage>
      </saml1p:Status>
    </saml1p:Response>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

/**
 * Build SAML LogoutRequest for Single Logout
 * This is sent to CAS applications during SLO
 */
export function buildLogoutRequest(sessionIndex: string): string {
  const requestId = generateSamlId();
  const timestamp = generateTimestamp();

  return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${requestId}" Version="2.0" IssueInstant="${timestamp}">
  <saml:NameID>@NOT_USED@</saml:NameID>
  <samlp:SessionIndex>${escapeXml(sessionIndex)}</samlp:SessionIndex>
</samlp:LogoutRequest>`;
}
