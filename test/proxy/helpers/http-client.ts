/**
 * HTTP Test Client for proxy integration tests
 *
 * Handles:
 * - Cookie management across requests
 * - Redirect following (with control)
 * - Form parsing and auto-submit detection
 * - Token/ticket extraction from URLs
 */

export interface RequestOptions {
  headers?: Record<string, string>;
  followRedirect?: boolean;
  maxRedirects?: number;
}

export interface TestResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  url: string;
  redirectUrl?: string;
}

export interface FormData {
  action: string;
  method: string;
  fields: Record<string, string>;
}

/**
 * Cookie jar for managing cookies across domains
 */
class CookieJar {
  private cookies: Map<string, Map<string, string>> = new Map();

  /**
   * Set a cookie for a domain
   */
  set(domain: string, name: string, value: string): void {
    if (!this.cookies.has(domain)) {
      this.cookies.set(domain, new Map());
    }
    this.cookies.get(domain)!.set(name, value);
  }

  /**
   * Get cookies for a domain
   */
  get(domain: string): Map<string, string> {
    return this.cookies.get(domain) || new Map();
  }

  /**
   * Get cookie header string for a domain
   */
  getCookieHeader(domain: string): string {
    const domainCookies = this.get(domain);
    if (domainCookies.size === 0) return "";
    return Array.from(domainCookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  /**
   * Parse Set-Cookie header and store cookies
   */
  parseSetCookie(domain: string, setCookieHeaders: string[]): void {
    for (const header of setCookieHeaders) {
      const parts = header.split(";")[0].split("=");
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const value = parts.slice(1).join("=").trim();
        // Don't store empty/deleted cookies
        if (value && value !== "0" && value !== '""') {
          this.set(domain, name, value);
        } else {
          // Remove cookie if value is empty/0
          const domainCookies = this.cookies.get(domain);
          if (domainCookies) {
            domainCookies.delete(name);
          }
        }
      }
    }
  }

  /**
   * Clear all cookies
   */
  clear(): void {
    this.cookies.clear();
  }

  /**
   * Clear cookies for a specific domain
   */
  clearDomain(domain: string): void {
    this.cookies.delete(domain);
  }
}

/**
 * Test HTTP Client
 */
export class TestHttpClient {
  private cookieJar: CookieJar = new CookieJar();

  /**
   * Extract domain from URL
   */
  private getDomain(url: string): string {
    const parsed = new URL(url);
    return parsed.host;
  }

  /**
   * Make a GET request
   */
  async get(url: string, options: RequestOptions = {}): Promise<TestResponse> {
    const domain = this.getDomain(url);
    const cookieHeader = this.cookieJar.getCookieHeader(domain);

    const headers: Record<string, string> = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "LemonLDAP-Test-Client/1.0",
      ...options.headers,
    };

    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      redirect: "manual",
    });

    return this.processResponse(url, response, options);
  }

  /**
   * Make a POST request with form data
   */
  async postForm(
    url: string,
    data: Record<string, string>,
    options: RequestOptions = {},
  ): Promise<TestResponse> {
    const domain = this.getDomain(url);
    const cookieHeader = this.cookieJar.getCookieHeader(domain);

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "LemonLDAP-Test-Client/1.0",
      ...options.headers,
    };

    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const body = new URLSearchParams(data).toString();

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
    });

    return this.processResponse(url, response, options);
  }

  /**
   * Make a POST request with raw body
   */
  async post(
    url: string,
    body: string,
    contentType: string,
    options: RequestOptions = {},
  ): Promise<TestResponse> {
    const domain = this.getDomain(url);
    const cookieHeader = this.cookieJar.getCookieHeader(domain);

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "LemonLDAP-Test-Client/1.0",
      ...options.headers,
    };

    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
    });

    return this.processResponse(url, response, options);
  }

  /**
   * Process response, handle cookies
   */
  private async processResponse(
    url: string,
    response: Response,
    options: RequestOptions,
  ): Promise<TestResponse> {
    const domain = this.getDomain(url);

    // Parse Set-Cookie headers
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    if (setCookieHeaders.length > 0) {
      this.cookieJar.parseSetCookie(domain, setCookieHeaders);
    }

    // Build headers object
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const body = await response.text();
    const redirectUrl = response.headers.get("location") || undefined;

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
      url,
      redirectUrl,
    };
  }

  /**
   * Follow a redirect from a response
   */
  async followRedirect(response: TestResponse): Promise<TestResponse> {
    if (!response.redirectUrl) {
      throw new Error("No redirect URL in response");
    }

    // Handle relative URLs
    let redirectUrl = response.redirectUrl;
    if (redirectUrl.startsWith("/")) {
      const parsed = new URL(response.url);
      redirectUrl = `${parsed.origin}${redirectUrl}`;
    }

    return this.get(redirectUrl);
  }

  /**
   * Follow all redirects until a non-redirect response
   */
  async followAllRedirects(
    response: TestResponse,
    maxRedirects = 10,
  ): Promise<TestResponse> {
    let current = response;
    let count = 0;

    while (
      (current.status === 302 || current.status === 301) &&
      current.redirectUrl &&
      count < maxRedirects
    ) {
      current = await this.followRedirect(current);
      count++;
    }

    return current;
  }

  /**
   * Extract form from HTML response
   */
  extractForm(html: string): FormData | null {
    // Match form tag
    const formMatch = html.match(
      /<form[^>]*action="([^"]*)"[^>]*method="([^"]*)"[^>]*>/i,
    );
    if (!formMatch) {
      // Try alternate format
      const formMatch2 = html.match(
        /<form[^>]*method="([^"]*)"[^>]*action="([^"]*)"[^>]*>/i,
      );
      if (!formMatch2) {
        // Try form without action (same page)
        const formMatch3 = html.match(/<form[^>]*>/i);
        if (!formMatch3) return null;

        return {
          action: "",
          method: "post",
          fields: this.extractFormFields(html),
        };
      }
      return {
        action: formMatch2[2],
        method: formMatch2[1].toLowerCase(),
        fields: this.extractFormFields(html),
      };
    }

    return {
      action: formMatch[1],
      method: formMatch[2].toLowerCase(),
      fields: this.extractFormFields(html),
    };
  }

  /**
   * Extract form fields from HTML
   */
  private extractFormFields(html: string): Record<string, string> {
    const fields: Record<string, string> = {};

    // Match input fields
    const inputPattern =
      /<input[^>]*type="hidden"[^>]*name="([^"]*)"[^>]*value="([^"]*)"[^>]*>/gi;
    let match;
    while ((match = inputPattern.exec(html)) !== null) {
      fields[match[1]] = match[2];
    }

    // Try alternate order (value before name)
    const inputPattern2 =
      /<input[^>]*value="([^"]*)"[^>]*type="hidden"[^>]*name="([^"]*)"[^>]*>/gi;
    while ((match = inputPattern2.exec(html)) !== null) {
      fields[match[2]] = match[1];
    }

    // Try another order (name before type)
    const inputPattern3 =
      /<input[^>]*name="([^"]*)"[^>]*type="hidden"[^>]*value="([^"]*)"[^>]*>/gi;
    while ((match = inputPattern3.exec(html)) !== null) {
      fields[match[1]] = match[2];
    }

    return fields;
  }

  /**
   * Extract auto-submit form (JavaScript redirect via form POST)
   * Used for SAML HTTP-POST binding
   */
  extractAutoSubmitForm(html: string): FormData | null {
    // Look for onload submit pattern
    if (!html.includes("onload") && !html.includes("submit()")) {
      return null;
    }
    return this.extractForm(html);
  }

  /**
   * Extract SAML request/response from URL query or form
   */
  extractSAMLData(
    response: TestResponse,
  ): { type: "redirect" | "post"; data: Record<string, string> } | null {
    // Check URL for SAMLRequest/SAMLResponse
    if (response.redirectUrl) {
      const parsed = new URL(response.redirectUrl, "http://localhost");
      const samlRequest = parsed.searchParams.get("SAMLRequest");
      const samlResponse = parsed.searchParams.get("SAMLResponse");
      const relayState = parsed.searchParams.get("RelayState");

      if (samlRequest || samlResponse) {
        const data: Record<string, string> = {};
        if (samlRequest) data.SAMLRequest = samlRequest;
        if (samlResponse) data.SAMLResponse = samlResponse;
        if (relayState) data.RelayState = relayState;
        return { type: "redirect", data };
      }
    }

    // Check body for SAML POST form
    const form = this.extractAutoSubmitForm(response.body);
    if (form) {
      const samlRequest = form.fields.SAMLRequest;
      const samlResponse = form.fields.SAMLResponse;
      if (samlRequest || samlResponse) {
        return { type: "post", data: form.fields };
      }
    }

    return null;
  }

  /**
   * Extract OIDC authorization code from redirect URL
   */
  extractOIDCCode(
    response: TestResponse,
  ): { code: string; state: string } | null {
    if (!response.redirectUrl) return null;

    const parsed = new URL(response.redirectUrl, "http://localhost");
    const code = parsed.searchParams.get("code");
    const state = parsed.searchParams.get("state");

    if (code && state) {
      return { code, state };
    }
    return null;
  }

  /**
   * Extract CAS ticket from redirect URL
   */
  extractCASTicket(response: TestResponse): string | null {
    if (!response.redirectUrl) return null;

    const parsed = new URL(response.redirectUrl, "http://localhost");
    return parsed.searchParams.get("ticket");
  }

  /**
   * Get cookies for a domain
   */
  getCookies(domain: string): Map<string, string> {
    return this.cookieJar.get(domain);
  }

  /**
   * Get a specific cookie
   */
  getCookie(domain: string, name: string): string | undefined {
    return this.cookieJar.get(domain).get(name);
  }

  /**
   * Set a cookie manually
   */
  setCookie(domain: string, name: string, value: string): void {
    this.cookieJar.set(domain, name, value);
  }

  /**
   * Clear all cookies
   */
  clearCookies(): void {
    this.cookieJar.clear();
  }
}
