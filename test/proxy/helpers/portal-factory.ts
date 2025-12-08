/**
 * Portal Factory for Proxy Integration Tests
 *
 * Creates test portals (IdP, Proxy, SP) with configurable
 * authentication and issuer modules.
 */

import * as express from "express";
import { Express, Router, Request, Response, NextFunction } from "express";
import { Server } from "http";
import * as cookieParser from "cookie-parser";
import {
  generateTestKeys,
  silentLogger,
  demoUsers,
  type TestKeysResult,
} from "./test-keys";

/**
 * Protocol types
 */
export type Protocol = "OIDC" | "SAML" | "CAS";

/**
 * Test portal instance
 */
export interface TestPortal {
  name: string;
  url: string;
  port: number;
  app: Express;
  server?: Server;
  sessions: Map<string, any>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getSession: (id: string) => any | null;
  createSession: (id: string, data: any) => void;
  deleteSession: (id: string) => void;
}

/**
 * Proxy testbed with 3 portals
 */
export interface ProxyTestbed {
  idp: TestPortal;
  proxy: TestPortal;
  sp: TestPortal;
  keys: TestKeysResult;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Portal configuration
 */
interface PortalConfig {
  name: string;
  port: number;
  domain: string;
  authType?: "Demo" | "OIDC" | "SAML" | "CAS";
  issuers?: {
    oidc?: boolean;
    saml?: boolean;
    cas?: boolean;
  };
}

/**
 * Generate random session ID
 */
function generateSessionId(): string {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a basic test portal
 */
function createTestPortal(config: PortalConfig): TestPortal {
  const sessions = new Map<string, any>();
  const app = (express as any).default
    ? (express as any).default()
    : (express as any)();

  app.use(
    (cookieParser as any).default
      ? (cookieParser as any).default()
      : (cookieParser as any)(),
  );
  app.use(((express as any).default || express).urlencoded({ extended: true }));
  app.use(((express as any).default || express).json());
  app.use(
    ((express as any).default || express).raw({ type: "application/xml" }),
  );
  app.use(
    ((express as any).default || express).text({ type: "application/xml" }),
  );

  let server: Server | undefined;

  const portal: TestPortal = {
    name: config.name,
    url: `http://${config.domain}:${config.port}`,
    port: config.port,
    app,
    sessions,
    async start() {
      if (server) return;
      return new Promise((resolve) => {
        server = app.listen(config.port, () => {
          portal.server = server;
          resolve();
        });
      });
    },
    async stop() {
      if (server) {
        return new Promise((resolve) => {
          server!.close(() => resolve());
          server = undefined;
        });
      }
    },
    getSession(id: string) {
      return sessions.get(id) || null;
    },
    createSession(id: string, data: any) {
      sessions.set(id, {
        _session_id: id,
        _utime: Math.floor(Date.now() / 1000),
        ...data,
      });
    },
    deleteSession(id: string) {
      sessions.delete(id);
    },
  };

  return portal;
}

/**
 * Session middleware
 */
function sessionMiddleware(portal: TestPortal) {
  return (req: any, _res: Response, next: NextFunction) => {
    const sessionId = req.cookies?.lemonldap;
    if (sessionId) {
      const session = portal.getSession(sessionId);
      if (session) {
        req.llngSession = session;
        req.llngSessionId = sessionId;
      }
    }
    next();
  };
}

/**
 * Demo authentication routes
 */
function demoAuthRoutes(portal: TestPortal): Router {
  const router = Router();

  // Login form
  router.get("/", (req: any, res) => {
    // Check for existing session
    if (req.llngSession) {
      return res.send(`
        <html>
        <body>
          <h1>Logged in as ${req.llngSession._user}</h1>
          <p>uid: ${req.llngSession.uid}</p>
          <p>mail: ${req.llngSession.mail}</p>
          <a href="/?logout=1">Logout</a>
        </body>
        </html>
      `);
    }

    // Check for logout
    if (req.query.logout) {
      if (req.llngSessionId) {
        portal.deleteSession(req.llngSessionId);
      }
      res.clearCookie("lemonldap");
      return res.send("<html><body>Logged out</body></html>");
    }

    // Show login form
    const urldc = req.query.url || "";
    res.send(`
      <html>
      <body>
        <form method="post" action="/">
          <input type="hidden" name="url" value="${urldc}" />
          <input type="text" name="user" />
          <input type="password" name="password" />
          <button type="submit">Login</button>
        </form>
      </body>
      </html>
    `);
  });

  // Login submit
  router.post("/", (req: any, res) => {
    const { user, password, url } = req.body;

    // Check demo credentials
    const userData = (demoUsers as any)[user];
    if (!userData || userData.password !== password) {
      return res.status(401).send(`
        <html>
        <body>
          <h1>Authentication failed</h1>
          <a href="/">Try again</a>
        </body>
        </html>
      `);
    }

    // Create session
    const sessionId = generateSessionId();
    portal.createSession(sessionId, {
      _user: user,
      uid: userData.uid,
      cn: userData.cn,
      mail: userData.mail,
      sn: userData.sn,
      givenName: userData.givenName,
    });

    res.cookie("lemonldap", sessionId, { httpOnly: true });

    // Redirect to original URL or show success
    if (url) {
      return res.redirect(url);
    }

    res.redirect("/");
  });

  return router;
}

/**
 * Create OIDC Issuer (OP) configuration
 */
async function setupOIDCIssuer(
  portal: TestPortal,
  keys: TestKeysResult,
  rpConfigs: Array<{
    confKey: string;
    clientId: string;
    clientSecret: string;
    redirectUris: string[];
    postLogoutRedirectUris?: string[];
    bypassConsent?: boolean;
  }>,
): Promise<void> {
  const { OIDCProvider } =
    await import("../../../packages/issuer-oidc/src/provider");
  const { createOIDCRouter } =
    await import("../../../packages/issuer-oidc/src/router");

  // Build RP metadata
  const oidcRPMetaDataOptions: Record<string, any> = {};
  const oidcRPMetaDataExportedVars: Record<string, any> = {};

  for (const rp of rpConfigs) {
    oidcRPMetaDataOptions[rp.confKey] = {
      oidcRPMetaDataOptionsClientID: rp.clientId,
      oidcRPMetaDataOptionsClientSecret: rp.clientSecret,
      oidcRPMetaDataOptionsRedirectUris: rp.redirectUris,
      oidcRPMetaDataOptionsBypassConsent: rp.bypassConsent ?? true,
      oidcRPMetaDataOptionsIDTokenExpiration: 3600,
      oidcRPMetaDataOptionsAccessTokenExpiration: 3600,
      oidcRPMetaDataOptionsIDTokenSignAlg: "RS256",
      oidcRPMetaDataOptionsPostLogoutRedirectUris:
        rp.postLogoutRedirectUris || [],
    };
    oidcRPMetaDataExportedVars[rp.confKey] = {
      email: "mail",
      family_name: "sn",
      given_name: "givenName",
      name: "cn",
    };
  }

  const keySet = keys[portal.name as keyof typeof keys] || keys.idp;

  const provider = new OIDCProvider({
    oidcServiceMetaDataIssuer: portal.url,
    oidcServicePrivateKeySig: keySet.privateKey,
    oidcServiceKeyIdSig: keySet.keyId,
    // Configure endpoint URIs with /oauth2 prefix (what discovery metadata reports)
    oidcServiceMetaDataAuthorizeURI: "/oauth2/authorize",
    oidcServiceMetaDataTokenURI: "/oauth2/token",
    oidcServiceMetaDataUserInfoURI: "/oauth2/userinfo",
    oidcServiceMetaDataJWKSURI: "/oauth2/jwks",
    oidcServiceMetaDataIntrospectionURI: "/oauth2/introspect",
    oidcServiceMetaDataRevokeURI: "/oauth2/revoke",
    oidcServiceMetaDataEndSessionURI: "/oauth2/logout",
    oidcServiceMetaDataRegistrationURI: "/oauth2/register",
    oidcServiceMetaDataCheckSessionURI: "/oauth2/checksession",
    oidcRPMetaDataOptions,
    oidcRPMetaDataExportedVars,
    getSession: async (sessionId: string) => {
      const session = portal.getSession(sessionId);
      return session || null;
    },
    logger: silentLogger,
  });

  await provider.init();

  const router = createOIDCRouter({
    provider,
    checkAuth: async (req: any) => {
      if (req.llngSession) {
        return {
          userId: req.llngSession._user,
          sessionId: req.llngSessionId,
        };
      }
      return null;
    },
    handleConsent: async () => true,
    renderLogin: (_req: Request, res: Response, returnUrl: string) => {
      // Redirect to portal root with return URL
      res.redirect(`${portal.url}/?url=${encodeURIComponent(returnUrl)}`);
    },
  });

  portal.app.use(sessionMiddleware(portal));
  // Mount router at /oauth2 for all OAuth2 endpoints
  portal.app.use("/oauth2", router);
  // Also add discovery endpoint at root
  portal.app.get(
    "/.well-known/openid-configuration",
    (_req: Request, res: Response) => {
      res.json(provider.getDiscoveryMetadata());
    },
  );
}

/**
 * Create CAS Issuer configuration
 */
async function setupCASIssuer(
  portal: TestPortal,
  appConfigs: Array<{
    confKey: string;
    service: string;
  }>,
): Promise<void> {
  const { CASIssuer } = await import("../../../packages/issuer-cas/src/issuer");

  const casAppMetaDataOptions: Record<string, any> = {};

  for (const app of appConfigs) {
    casAppMetaDataOptions[app.confKey] = {
      casAppMetaDataOptions: {
        casAppMetaDataOptionsService: app.service,
      },
      casAppMetaDataExportedVars: {
        cn: "cn",
        mail: "mail",
        uid: "uid",
      },
    };
  }

  // In-memory ticket store
  const tickets = new Map<string, any>();

  const issuer = new CASIssuer({
    casAccessControlPolicy: "none",
    casAppMetaDataOptions,
    ticketStore: {
      get: async (id: string) => tickets.get(id) || null,
      set: async (id: string, data: any) => {
        tickets.set(id, data);
      },
      delete: async (id: string) => {
        tickets.delete(id);
      },
    },
    getSession: async (sessionId: string) => {
      return portal.getSession(sessionId);
    },
    logger: silentLogger,
  });

  await issuer.init();

  // Create manual CAS routes
  const router = Router();

  // CAS login endpoint
  router.get("/login", async (req: any, res: Response) => {
    const service = req.query.service as string;
    const renew = req.query.renew === "true";
    const gateway = req.query.gateway === "true";

    if (!req.llngSession) {
      // Redirect to portal for authentication
      const returnUrl = `${portal.url}/cas/login?service=${encodeURIComponent(service || "")}`;
      return res.redirect(
        `${portal.url}/?url=${encodeURIComponent(returnUrl)}`,
      );
    }

    // User is authenticated, handle CAS login
    const result = await issuer.handleLogin(
      { service, renew, gateway },
      req.llngSession,
    );

    if (result.type === "redirect") {
      return res.redirect(result.url);
    } else if (result.type === "error") {
      return res.status(400).send(result.message);
    } else if (result.type === "gateway") {
      return res.redirect(result.url);
    }
    res.status(500).send("Unexpected result");
  });

  // CAS logout endpoint
  router.get("/logout", async (req: any, res: Response) => {
    const service = req.query.service as string;
    const url = req.query.url as string;

    if (req.llngSessionId) {
      await issuer.handleLogout({ service, url }, req.llngSessionId);
      portal.deleteSession(req.llngSessionId);
    }
    res.clearCookie("lemonldap");

    if (service || url) {
      return res.redirect(service || url);
    }
    res.send("Logged out");
  });

  // CAS validate endpoint (1.0)
  router.get("/validate", async (req: any, res: Response) => {
    const service = req.query.service as string;
    const ticket = req.query.ticket as string;
    const renew = req.query.renew === "true";

    const result = await issuer.handleValidate({ service, ticket, renew });
    res.type("text/plain").send(result);
  });

  // CAS serviceValidate endpoint (2.0)
  router.get("/serviceValidate", async (req: any, res: Response) => {
    const service = req.query.service as string;
    const ticket = req.query.ticket as string;
    const pgtUrl = req.query.pgtUrl as string;
    const renew = req.query.renew === "true";

    const result = await issuer.handleServiceValidate({
      service,
      ticket,
      pgtUrl,
      renew,
    });
    res.type("application/xml").send(result);
  });

  // CAS p3/serviceValidate endpoint (3.0)
  router.get("/p3/serviceValidate", async (req: any, res: Response) => {
    const service = req.query.service as string;
    const ticket = req.query.ticket as string;
    const pgtUrl = req.query.pgtUrl as string;
    const renew = req.query.renew === "true";

    const result = await issuer.handleServiceValidate({
      service,
      ticket,
      pgtUrl,
      renew,
    });
    res.type("application/xml").send(result);
  });

  // CAS proxyValidate endpoint
  router.get("/proxyValidate", async (req: any, res: Response) => {
    const service = req.query.service as string;
    const ticket = req.query.ticket as string;
    const pgtUrl = req.query.pgtUrl as string;

    const result = await issuer.handleProxyValidate({
      service,
      ticket,
      pgtUrl,
    });
    res.type("application/xml").send(result);
  });

  // CAS proxy endpoint
  router.get("/proxy", async (req: any, res: Response) => {
    const pgt = req.query.pgt as string;
    const targetService = req.query.targetService as string;

    const result = await issuer.handleProxy({ pgt, targetService });
    res.type("application/xml").send(result);
  });

  // SAML validate endpoint
  router.post("/samlValidate", async (req: any, res: Response) => {
    const TARGET = req.query.TARGET as string;
    const body =
      typeof req.body === "string" ? req.body : req.body?.toString() || "";

    const result = await issuer.handleSamlValidate({ TARGET, body });
    res.type("application/xml").send(result);
  });

  portal.app.use(sessionMiddleware(portal));
  portal.app.use("/cas", router);
}

/**
 * Create OIDC Auth (RP) configuration
 */
async function setupOIDCAuth(
  portal: TestPortal,
  opConfig: {
    confKey: string;
    opUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  },
): Promise<void> {
  const { OIDCAuth } = await import("../../../packages/auth-oidc/src/auth");

  const auth = new OIDCAuth({
    oidcOPMetaData: {
      [opConfig.confKey]: {
        confKey: opConfig.confKey,
        oidcOPMetaDataOptions: {
          oidcOPMetaDataOptionsClientID: opConfig.clientId,
          oidcOPMetaDataOptionsClientSecret: opConfig.clientSecret,
          oidcOPMetaDataOptionsConfigurationURI: `${opConfig.opUrl}/.well-known/openid-configuration`,
          oidcOPMetaDataOptionsAuthorizeURI: `${opConfig.opUrl}/oauth2/authorize`,
          oidcOPMetaDataOptionsTokenURI: `${opConfig.opUrl}/oauth2/token`,
          oidcOPMetaDataOptionsUserInfoURI: `${opConfig.opUrl}/oauth2/userinfo`,
          oidcOPMetaDataOptionsScope: "openid profile email",
          oidcOPMetaDataOptionsUsePKCE: true,
          oidcOPMetaDataOptionsPKCEMethod: "S256",
        },
        oidcOPMetaDataExportedVars: {
          uid: "sub",
          mail: "email",
          cn: "name",
          givenName: "given_name",
          sn: "family_name",
        },
      },
    },
    logger: silentLogger,
  });

  await auth.init();

  const router = Router();

  // Handle OIDC callback and unauthenticated requests
  router.get("/", async (req: any, res, next) => {
    // First check for OIDC callback (has code and state params)
    if (req.query.code && req.query.state) {
      try {
        const result = await auth.handleCallback(
          req.query.code as string,
          req.query.state as string,
          opConfig.redirectUri,
        );

        if (result.success) {
          const sessionId = generateSessionId();
          portal.createSession(sessionId, {
            _user: result.userId,
            uid: result.userId,
            mail: result.userInfo?.email || "",
            cn: result.userInfo?.name || "",
            _oidcOP: opConfig.confKey,
          });

          res.cookie("lemonldap", sessionId, { httpOnly: true });
          // Redirect to the stored return URL from cookie, or to root
          const returnUrl = req.cookies?.llng_return_url;
          res.clearCookie("llng_return_url");
          return res.redirect(returnUrl || "/");
        }
      } catch (err) {
        // Fall through to next check
      }
    }

    // Already authenticated, pass to next handler
    if (req.llngSession) {
      return next();
    }

    // Not authenticated, store original URL and start OIDC flow
    // Store the original request URL (from ?url= param) for after callback
    const originalUrl = req.query.url as string;
    if (originalUrl) {
      res.cookie("llng_return_url", originalUrl, { httpOnly: true });
    }

    try {
      const url = await auth.getAuthorizationUrl(
        opConfig.confKey,
        opConfig.redirectUri,
      );
      res.redirect(url);
    } catch (err) {
      res.status(500).send("OIDC error: " + err);
    }
  });

  portal.app.use(sessionMiddleware(portal));
  portal.app.use("/", router);
}

/**
 * Create a simple HTTP client for CAS validation
 */
function createSimpleHttpClient() {
  return {
    async get(url: string): Promise<{ status: number; body: string }> {
      const http = url.startsWith("https") ? require("https") : require("http");
      return new Promise((resolve, reject) => {
        http
          .get(url, (res: any) => {
            let body = "";
            res.on("data", (chunk: string) => {
              body += chunk;
            });
            res.on("end", () => {
              resolve({ status: res.statusCode, body });
            });
          })
          .on("error", reject);
      });
    },
    async post(
      url: string,
      body: string,
      contentType?: string,
    ): Promise<{ status: number; body: string }> {
      const parsedUrl = new URL(url);
      const http = url.startsWith("https") ? require("https") : require("http");
      return new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: "POST",
            headers: {
              "Content-Type":
                contentType || "application/x-www-form-urlencoded",
              "Content-Length": Buffer.byteLength(body),
            },
          },
          (res: any) => {
            let respBody = "";
            res.on("data", (chunk: string) => {
              respBody += chunk;
            });
            res.on("end", () => {
              resolve({ status: res.statusCode, body: respBody });
            });
          },
        );
        req.on("error", reject);
        req.write(body);
        req.end();
      });
    },
  };
}

/**
 * Create CAS Auth configuration
 */
async function setupCASAuth(
  portal: TestPortal,
  casConfig: {
    confKey: string;
    casUrl: string;
    service: string;
  },
): Promise<void> {
  const { CASAuth } = await import("../../../packages/auth-cas/src/index");

  const auth = new CASAuth({
    casSrvMetaDataOptions: {
      [casConfig.confKey]: {
        casSrvMetaDataOptions: {
          casSrvMetaDataOptionsUrl: casConfig.casUrl,
        },
        casSrvMetaDataExportedVars: {
          cn: "cn",
          mail: "mail",
          uid: "uid",
        },
      },
    },
    serviceUrl: casConfig.service,
    httpClient: createSimpleHttpClient(),
    logger: silentLogger,
  });

  await auth.init();

  const router = Router();

  // Handle unauthenticated requests and CAS ticket validation
  router.get("/", async (req: any, res, next) => {
    if (req.llngSession) {
      return next();
    }

    // Check for ticket
    if (req.query.ticket) {
      try {
        // Build a minimal request object for extractCredentials
        const casReq = {
          url: casConfig.service,
          query: req.query,
          cookies: req.cookies,
        };

        const credentials = auth.extractCredentials(casReq);
        if (credentials) {
          const result = await auth.authenticate(credentials);

          if (result.success) {
            const sessionId = generateSessionId();
            portal.createSession(sessionId, {
              _user: result.userId,
              uid: result.userId,
              ...result.sessionData,
              _casServer: casConfig.confKey,
            });

            res.cookie("lemonldap", sessionId, { httpOnly: true });
            return res.redirect("/");
          }
        }
      } catch (err) {
        // Fall through to CAS redirect
        console.error("CAS auth error:", err);
      }
    }

    // Redirect to CAS
    const loginUrl = auth.buildLoginUrl({
      serverKey: casConfig.confKey,
      returnUrl: casConfig.service,
    });
    res.redirect(loginUrl);
  });

  portal.app.use(sessionMiddleware(portal));
  portal.app.use("/", router);
}

/**
 * Generate SAML metadata for a portal
 * Note: Always generates both IDPSSODescriptor and SPSSODescriptor
 * to match what ServerManager generates (lasso expects compatible metadata)
 */
function generateSAMLMetadata(
  entityId: string,
  portalUrl: string,
  certificate: string,
): string {
  const url = portalUrl.replace(/\/$/, "");
  // Extract certificate content (remove PEM headers)
  const certContent = certificate
    .replace(/-----BEGIN.*-----/g, "")
    .replace(/-----END.*-----/g, "")
    .replace(/\s/g, "");

  // Always include both descriptors (matching ServerManager.generateMetadata())
  return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                  entityID="${entityId}">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" WantAuthnRequestsSigned="false">
    <KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${certContent}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${url}/saml/singleSignOn"/>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${url}/saml/singleSignOn"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${url}/saml/singleLogout"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${url}/saml/singleLogout"/>
    <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</NameIDFormat>
    <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</NameIDFormat>
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
  </IDPSSODescriptor>
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" AuthnRequestsSigned="false" WantAssertionsSigned="false">
    <KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${certContent}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${url}/saml/singleLogout"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${url}/saml/singleLogout"/>
    <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${url}/saml/acs" index="1" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
}

/**
 * Create SAML Issuer (IdP) configuration
 */
async function setupSAMLIssuer(
  portal: TestPortal,
  keys: TestKeysResult,
  spConfigs: Array<{
    confKey: string;
    entityId: string;
    metadata: string;
    acsUrl: string;
  }>,
): Promise<void> {
  const { SAMLIssuer } =
    await import("../../../packages/issuer-saml/src/issuer");
  const { createSAMLIssuerRouter } =
    await import("../../../packages/issuer-saml/src/router");

  const keySet = keys[portal.name as keyof typeof keys] || keys.idp;

  // Build SP metadata configuration
  const samlSPMetaDataOptions: Record<string, any> = {};
  const samlSPMetaDataXML: Record<string, string> = {};
  const samlSPMetaDataExportedAttributes: Record<string, any[]> = {};

  for (const sp of spConfigs) {
    samlSPMetaDataOptions[sp.confKey] = {
      samlSPMetaDataOptionsEntityID: sp.entityId,
      samlSPMetaDataOptionsNameIDFormat: "persistent",
    };
    samlSPMetaDataXML[sp.confKey] = sp.metadata;
    samlSPMetaDataExportedAttributes[sp.confKey] = [
      { name: "uid", sessionKey: "uid", nameFormat: "basic" },
      { name: "mail", sessionKey: "mail", nameFormat: "basic" },
      { name: "cn", sessionKey: "cn", nameFormat: "basic" },
    ];
  }

  // SAML session storage
  const samlSessions = new Map<string, any>();
  const identities = new Map<string, string>();

  const issuer = new SAMLIssuer({
    portal: portal.url,
    samlEntityID: portal.url,
    samlServiceMetaDataPrivateKeySig: keySet.privateKey,
    samlServiceMetaDataPublicKeySig: keySet.certificate,
    samlSPMetaDataOptions,
    samlSPMetaDataXML,
    samlSPMetaDataExportedAttributes,
    getSession: async (sessionId: string) => {
      return portal.getSession(sessionId);
    },
    storeSAMLSession: async (sessionId: string, data: any) => {
      samlSessions.set(sessionId, data);
    },
    getSAMLSession: async (sessionId: string) => {
      return samlSessions.get(sessionId) || null;
    },
    storeIdentity: async (userId: string, spEntityId: string, dump: string) => {
      identities.set(`${userId}:${spEntityId}`, dump);
    },
    getIdentity: async (userId: string, spEntityId: string) => {
      return identities.get(`${userId}:${spEntityId}`) || null;
    },
    logger: silentLogger,
  });

  await issuer.init();

  const router = createSAMLIssuerRouter(issuer, {
    portal: portal.url,
    samlEntityID: portal.url,
    samlServiceMetaDataPrivateKeySig: keySet.privateKey,
    samlServiceMetaDataPublicKeySig: keySet.certificate,
    getSessionId: (req: any) => req.llngSessionId || null,
    getSessionData: async (sessionId: string) => {
      return portal.getSession(sessionId);
    },
    requireAuth: (req: any, res: Response, _next: NextFunction) => {
      // Store SAML context and redirect to login
      const returnUrl = `${portal.url}/saml/singleSignOn${req.url.includes("?") ? "&" : "?"}${new URLSearchParams(req.query).toString()}`;
      res.redirect(`${portal.url}/?url=${encodeURIComponent(returnUrl)}`);
    },
  });

  portal.app.use(sessionMiddleware(portal));
  portal.app.use("/saml", router);

  // Add metadata endpoint at root
  portal.app.get("/saml/metadata", (_req: Request, res: Response) => {
    res.set("Content-Type", "application/samlmetadata+xml");
    res.send(issuer.getMetadata());
  });
}

/**
 * Create SAML Auth (SP) configuration
 */
async function setupSAMLAuth(
  portal: TestPortal,
  keys: TestKeysResult,
  idpConfig: {
    confKey: string;
    entityId: string;
    metadata: string;
    ssoUrl: string;
  },
): Promise<void> {
  const { SAMLAuth } = await import("../../../packages/auth-saml/src/auth");

  const keySet = keys[portal.name as keyof typeof keys] || keys.sp;

  // Auth state storage
  const authStates = new Map<string, any>();
  const samlSessions = new Map<string, any>();

  const auth = new SAMLAuth({
    portal: portal.url,
    samlEntityID: portal.url,
    samlServiceMetaDataPrivateKeySig: keySet.privateKey,
    samlServiceMetaDataPublicKeySig: keySet.certificate,
    samlIdPMetaDataOptions: {
      [idpConfig.confKey]: {
        samlIdPMetaDataOptionsEntityID: idpConfig.entityId,
        samlIdPMetaDataOptionsSSOBinding: "http-redirect",
        samlIdPMetaDataOptionsSLOBinding: "http-redirect",
      },
    },
    samlIdPMetaDataXML: {
      [idpConfig.confKey]: idpConfig.metadata,
    },
    samlIdPDefault: idpConfig.confKey,
    storeAuthState: async (stateId: string, state: any) => {
      authStates.set(stateId, state);
    },
    consumeAuthState: async (stateId: string) => {
      const state = authStates.get(stateId);
      authStates.delete(stateId);
      return state || null;
    },
    storeSAMLSession: async (sessionId: string, data: any) => {
      samlSessions.set(sessionId, data);
    },
    getSAMLSession: async (sessionId: string) => {
      return samlSessions.get(sessionId) || null;
    },
    logger: silentLogger,
  });

  await auth.init();

  const router = Router();

  // Handle SAML callback (ACS endpoint)
  router.post("/saml/acs", async (req: any, res) => {
    try {
      const credentials = auth.extractCredentials({
        method: "POST",
        body: req.body,
        query: req.query,
      });

      if (!credentials) {
        return res.status(400).send("No SAML credentials found");
      }

      const result = await auth.authenticate(credentials);

      if (result.success) {
        const sessionId = generateSessionId();
        portal.createSession(sessionId, {
          _user: result.userId,
          uid: result.userId,
          mail: "",
          cn: result.userId,
          _samlIdP: idpConfig.confKey,
        });

        res.cookie("lemonldap", sessionId, { httpOnly: true });
        return res.redirect("/");
      }

      res.status(401).send("SAML authentication failed: " + result.error);
    } catch (err) {
      res.status(500).send("SAML error: " + err);
    }
  });

  // Handle unauthenticated requests
  router.get("/", async (req: any, res, next) => {
    if (req.llngSession) {
      return next();
    }

    // Store original URL for after callback
    const originalUrl = req.query.url as string;
    if (originalUrl) {
      res.cookie("llng_return_url", originalUrl, { httpOnly: true });
    }

    try {
      const response = await auth.buildAuthnRequest(
        idpConfig.confKey,
        `${portal.url}/saml/acs`,
      );

      if (response.method === "POST" && response.formData) {
        // Send auto-submit form
        const form = `
          <html>
          <body onload="document.forms[0].submit()">
            <form method="post" action="${response.url}">
              <input type="hidden" name="SAMLRequest" value="${response.formData.SAMLRequest}" />
              ${response.formData.RelayState ? `<input type="hidden" name="RelayState" value="${response.formData.RelayState}" />` : ""}
              <noscript><button type="submit">Continue</button></noscript>
            </form>
          </body>
          </html>
        `;
        res.send(form);
      } else {
        res.redirect(response.url);
      }
    } catch (err) {
      res.status(500).send("SAML error: " + err);
    }
  });

  portal.app.use(sessionMiddleware(portal));
  portal.app.use("/", router);

  // Add metadata endpoint
  portal.app.get("/saml/metadata", (_req: Request, res: Response) => {
    res.set("Content-Type", "application/samlmetadata+xml");
    res.send(auth.getMetadata());
  });
}

/**
 * Create a proxy testbed for a specific protocol combination
 */
export async function createProxyTestbed(
  frontendProtocol: Protocol,
  backendProtocol: Protocol,
  portOffset = 0,
): Promise<ProxyTestbed> {
  const keys = await generateTestKeys();

  const IDP_PORT = 19080 + portOffset;
  const PROXY_PORT = 19081 + portOffset;
  const SP_PORT = 19082 + portOffset;

  // Create portals
  const idp = createTestPortal({
    name: "idp",
    port: IDP_PORT,
    domain: "localhost",
    authType: "Demo",
    issuers: { [frontendProtocol.toLowerCase()]: true } as any,
  });

  const proxy = createTestPortal({
    name: "proxy",
    port: PROXY_PORT,
    domain: "localhost",
    authType: frontendProtocol,
    issuers: { [backendProtocol.toLowerCase()]: true } as any,
  });

  const sp = createTestPortal({
    name: "sp",
    port: SP_PORT,
    domain: "localhost",
    authType: backendProtocol,
  });

  // Configure IdP with Demo auth + frontend protocol issuer
  idp.app.use(sessionMiddleware(idp));
  idp.app.use(demoAuthRoutes(idp));

  if (frontendProtocol === "OIDC") {
    await setupOIDCIssuer(idp, keys, [
      {
        confKey: "proxy",
        clientId: "proxy-client",
        clientSecret: "proxy-secret",
        redirectUris: [`${proxy.url}/?openidconnectcallback=1`],
        postLogoutRedirectUris: [`${proxy.url}/oauth2/rlogoutreturn`],
      },
    ]);
  } else if (frontendProtocol === "CAS") {
    await setupCASIssuer(idp, [
      {
        confKey: "proxy",
        service: proxy.url,
      },
    ]);
  } else if (frontendProtocol === "SAML") {
    // Generate SP metadata for proxy (always includes both IdP and SP descriptors)
    const proxySpMetadata = generateSAMLMetadata(
      proxy.url,
      proxy.url,
      keys.proxy.certificate,
    );
    await setupSAMLIssuer(idp, keys, [
      {
        confKey: "proxy",
        entityId: proxy.url,
        metadata: proxySpMetadata,
        acsUrl: `${proxy.url}/saml/acs`,
      },
    ]);
  }

  // Configure Proxy with frontend auth + backend issuer
  if (frontendProtocol === "OIDC") {
    await setupOIDCAuth(proxy, {
      confKey: "idp",
      opUrl: idp.url,
      clientId: "proxy-client",
      clientSecret: "proxy-secret",
      redirectUri: `${proxy.url}/?openidconnectcallback=1`,
    });
  } else if (frontendProtocol === "CAS") {
    await setupCASAuth(proxy, {
      confKey: "idp",
      casUrl: `${idp.url}/cas`,
      service: proxy.url,
    });
  } else if (frontendProtocol === "SAML") {
    // Generate IdP metadata for idp (always includes both IdP and SP descriptors)
    const idpMetadata = generateSAMLMetadata(
      idp.url,
      idp.url,
      keys.idp.certificate,
    );
    await setupSAMLAuth(proxy, keys, {
      confKey: "idp",
      entityId: idp.url,
      metadata: idpMetadata,
      ssoUrl: `${idp.url}/saml/singleSignOn`,
    });
  }

  if (backendProtocol === "OIDC") {
    await setupOIDCIssuer(proxy, keys, [
      {
        confKey: "sp",
        clientId: "sp-client",
        clientSecret: "sp-secret",
        redirectUris: [`${sp.url}/?openidconnectcallback=1`],
        postLogoutRedirectUris: [`${sp.url}/oauth2/rlogoutreturn`],
      },
    ]);
  } else if (backendProtocol === "CAS") {
    await setupCASIssuer(proxy, [
      {
        confKey: "sp",
        service: sp.url,
      },
    ]);
  } else if (backendProtocol === "SAML") {
    // Generate SP metadata for sp (always includes both IdP and SP descriptors)
    const spSpMetadata = generateSAMLMetadata(
      sp.url,
      sp.url,
      keys.sp.certificate,
    );
    await setupSAMLIssuer(proxy, keys, [
      {
        confKey: "sp",
        entityId: sp.url,
        metadata: spSpMetadata,
        acsUrl: `${sp.url}/saml/acs`,
      },
    ]);
  }

  // Configure SP with backend auth
  if (backendProtocol === "OIDC") {
    await setupOIDCAuth(sp, {
      confKey: "proxy",
      opUrl: proxy.url,
      clientId: "sp-client",
      clientSecret: "sp-secret",
      redirectUri: `${sp.url}/?openidconnectcallback=1`,
    });
  } else if (backendProtocol === "CAS") {
    await setupCASAuth(sp, {
      confKey: "proxy",
      casUrl: `${proxy.url}/cas`,
      service: sp.url,
    });
  } else if (backendProtocol === "SAML") {
    // Generate IdP metadata for proxy (always includes both IdP and SP descriptors)
    const proxyIdpMetadata = generateSAMLMetadata(
      proxy.url,
      proxy.url,
      keys.proxy.certificate,
    );
    await setupSAMLAuth(sp, keys, {
      confKey: "proxy",
      entityId: proxy.url,
      metadata: proxyIdpMetadata,
      ssoUrl: `${proxy.url}/saml/singleSignOn`,
    });
  }

  // Add authenticated page to SP
  sp.app.get("/", (req: any, res) => {
    if (req.llngSession) {
      res.send(`
        <html>
        <body>
          <h1>SP - Authenticated</h1>
          <p>User: ${req.llngSession._user}</p>
          <p>uid: ${req.llngSession.uid}</p>
          <p>mail: ${req.llngSession.mail}</p>
        </body>
        </html>
      `);
    } else {
      res.status(401).send("Not authenticated");
    }
  });

  return {
    idp,
    proxy,
    sp,
    keys,
    async start() {
      await Promise.all([idp.start(), proxy.start(), sp.start()]);
    },
    async stop() {
      await Promise.all([idp.stop(), proxy.stop(), sp.stop()]);
    },
  };
}

/**
 * Create a simple OIDC-OIDC proxy testbed
 */
export async function createOIDCOIDCTestbed(
  portOffset = 0,
): Promise<ProxyTestbed> {
  return createProxyTestbed("OIDC", "OIDC", portOffset);
}

/**
 * Create a simple CAS-CAS proxy testbed
 */
export async function createCASCASTestbed(
  portOffset = 0,
): Promise<ProxyTestbed> {
  return createProxyTestbed("CAS", "CAS", portOffset);
}

/**
 * Create a OIDC-SAML proxy testbed (OIDC frontend, SAML backend)
 */
export async function createOIDCSAMLTestbed(
  portOffset = 0,
): Promise<ProxyTestbed> {
  return createProxyTestbed("OIDC", "SAML", portOffset);
}

/**
 * Create a SAML-OIDC proxy testbed (SAML frontend, OIDC backend)
 */
export async function createSAMLOIDCTestbed(
  portOffset = 0,
): Promise<ProxyTestbed> {
  return createProxyTestbed("SAML", "OIDC", portOffset);
}

/**
 * Create a SAML-SAML proxy testbed
 */
export async function createSAMLSAMLTestbed(
  portOffset = 0,
): Promise<ProxyTestbed> {
  return createProxyTestbed("SAML", "SAML", portOffset);
}

// Export generateSAMLMetadata for tests that need custom metadata
export { generateSAMLMetadata };
