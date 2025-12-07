/**
 * Express Router for OIDC Provider endpoints
 */

import { Router, Request, Response } from "express";
import { OIDCProvider } from "./provider";
import {
  AuthorizationRequest,
  TokenRequest,
  ClientRegistrationRequest,
} from "./types";

/**
 * Router options
 */
export interface OIDCRouterOptions {
  /** OIDC Provider instance */
  provider: OIDCProvider;

  /**
   * Callback to check if user is authenticated
   * Should return user ID and session ID if authenticated, null otherwise
   */
  checkAuth?: (
    req: Request,
  ) => Promise<{ userId: string; sessionId: string } | null>;

  /**
   * Callback to handle consent
   * Should return true if consent is granted, false to show consent page
   */
  handleConsent?: (
    req: Request,
    clientId: string,
    scope: string,
  ) => Promise<boolean>;

  /**
   * Callback to render login page
   */
  renderLogin?: (req: Request, res: Response, returnUrl: string) => void;

  /**
   * Callback to render consent page
   */
  renderConsent?: (
    req: Request,
    res: Response,
    clientId: string,
    scope: string,
    returnUrl: string,
  ) => void;

  /**
   * Callback to render logout page
   */
  renderLogout?: (req: Request, res: Response, postLogoutUrl?: string) => void;
}

/**
 * Create OIDC router
 */
export function createOIDCRouter(options: OIDCRouterOptions): Router {
  const router = Router();
  const { provider } = options;

  // Initialize provider
  provider.init().catch((err) => {
    console.error("Failed to initialize OIDC provider:", err);
  });

  // Discovery endpoint
  router.get(
    "/.well-known/openid-configuration",
    (req: Request, res: Response) => {
      res.json(provider.getDiscoveryMetadata());
    },
  );

  // JWKS endpoint
  router.get("/jwks", async (req: Request, res: Response) => {
    try {
      const jwks = await provider.getJWKS();
      res.json(jwks);
    } catch {
      res.status(500).json({
        error: "server_error",
        error_description: "Failed to get JWKS",
      });
    }
  });

  // Authorization endpoint
  router.get("/authorize", async (req: Request, res: Response) => {
    await handleAuthorization(req, res, options);
  });

  router.post("/authorize", async (req: Request, res: Response) => {
    await handleAuthorization(req, res, options);
  });

  // Token endpoint
  router.post("/token", async (req: Request, res: Response) => {
    await handleToken(req, res, provider);
  });

  // UserInfo endpoint
  router.get("/userinfo", async (req: Request, res: Response) => {
    await handleUserInfo(req, res, provider);
  });

  router.post("/userinfo", async (req: Request, res: Response) => {
    await handleUserInfo(req, res, provider);
  });

  // Introspection endpoint
  router.post("/introspect", async (req: Request, res: Response) => {
    await handleIntrospection(req, res, provider);
  });

  // Revocation endpoint
  router.post("/revoke", async (req: Request, res: Response) => {
    await handleRevocation(req, res, provider);
  });

  // End session endpoint
  router.get("/logout", async (req: Request, res: Response) => {
    await handleEndSession(req, res, options);
  });

  router.post("/logout", async (req: Request, res: Response) => {
    await handleEndSession(req, res, options);
  });

  // Dynamic Client Registration endpoint
  router.post("/register", async (req: Request, res: Response) => {
    await handleRegistration(req, res, provider);
  });

  return router;
}

/**
 * Handle authorization request
 */
async function handleAuthorization(
  req: Request,
  res: Response,
  options: OIDCRouterOptions,
): Promise<void> {
  const { provider, checkAuth, handleConsent, renderLogin, renderConsent } =
    options;

  // Get parameters from query or body
  const params: AuthorizationRequest = {
    response_type: (req.query.response_type ||
      req.body?.response_type) as string,
    client_id: (req.query.client_id || req.body?.client_id) as string,
    redirect_uri: (req.query.redirect_uri || req.body?.redirect_uri) as string,
    scope: (req.query.scope || req.body?.scope) as string,
    state: (req.query.state || req.body?.state) as string,
    nonce: (req.query.nonce || req.body?.nonce) as string,
    response_mode: (req.query.response_mode || req.body?.response_mode) as
      | "query"
      | "fragment"
      | "form_post",
    code_challenge: (req.query.code_challenge ||
      req.body?.code_challenge) as string,
    code_challenge_method: (req.query.code_challenge_method ||
      req.body?.code_challenge_method) as "S256" | "plain",
    prompt: (req.query.prompt || req.body?.prompt) as string,
    login_hint: (req.query.login_hint || req.body?.login_hint) as string,
    max_age: req.query.max_age
      ? parseInt(req.query.max_age as string, 10)
      : undefined,
  };

  // Validate request
  const error = provider.validateAuthorizationRequest(params);
  if (error) {
    redirectWithError(
      res,
      params.redirect_uri,
      error,
      params.state,
      params.response_mode,
    );
    return;
  }

  // Check if user is authenticated
  const authInfo = checkAuth ? await checkAuth(req) : null;

  if (!authInfo) {
    // User not authenticated, redirect to login
    if (renderLogin) {
      const returnUrl = req.originalUrl;
      renderLogin(req, res, returnUrl);
    } else {
      redirectWithError(
        res,
        params.redirect_uri,
        { error: "login_required" },
        params.state,
        params.response_mode,
      );
    }
    return;
  }

  // Check consent
  const rp = provider.getRP(params.client_id);
  const needsConsent = !rp?.oidcRPMetaDataOptionsBypassConsent;

  if (needsConsent && params.prompt !== "none") {
    const consentGranted = handleConsent
      ? await handleConsent(req, params.client_id, params.scope || "openid")
      : true;

    if (!consentGranted) {
      if (renderConsent) {
        renderConsent(
          req,
          res,
          params.client_id,
          params.scope || "openid",
          req.originalUrl,
        );
      } else {
        redirectWithError(
          res,
          params.redirect_uri,
          { error: "consent_required" },
          params.state,
          params.response_mode,
        );
      }
      return;
    }
  }

  // Handle response_type
  const responseTypes = params.response_type.split(" ");

  try {
    const includesCode = responseTypes.includes("code");
    const includesToken = responseTypes.includes("token");
    const includesIdToken = responseTypes.includes("id_token");

    // Determine default response mode based on flow
    // - query for code only flow
    // - fragment for implicit flow (token, id_token, token id_token)
    // - fragment for hybrid flow (code + token/id_token)
    const isImplicitOrHybrid = includesToken || includesIdToken;
    const defaultResponseMode = isImplicitOrHybrid ? "fragment" : "query";
    const responseMode = params.response_mode || defaultResponseMode;

    const redirectParams: Record<string, string> = {};
    if (params.state) {
      redirectParams.state = params.state;
    }

    if (includesCode) {
      // Authorization code flow or hybrid flow
      const code = await provider.generateAuthorizationCode(
        params,
        authInfo.userId,
        authInfo.sessionId,
      );
      redirectParams.code = code;
    }

    if (includesToken || includesIdToken) {
      // Implicit or hybrid flow - generate tokens directly
      const tokens = await provider.generateTokensForImplicit(
        params,
        authInfo.userId,
        authInfo.sessionId,
        {
          includeAccessToken: includesToken,
          includeIdToken: includesIdToken,
        },
      );

      if (tokens.access_token) {
        redirectParams.access_token = tokens.access_token;
        redirectParams.token_type = "Bearer";
        if (tokens.expires_in) {
          redirectParams.expires_in = String(tokens.expires_in);
        }
      }
      if (tokens.id_token) {
        redirectParams.id_token = tokens.id_token;
      }
    }

    if (
      Object.keys(redirectParams).length === 0 ||
      (!includesCode && !includesToken && !includesIdToken)
    ) {
      redirectWithError(
        res,
        params.redirect_uri,
        { error: "unsupported_response_type" },
        params.state,
        responseMode,
      );
      return;
    }

    redirectWithParams(res, params.redirect_uri, redirectParams, responseMode);
  } catch {
    redirectWithError(
      res,
      params.redirect_uri,
      { error: "server_error", error_description: "Internal error" },
      params.state,
      params.response_mode,
    );
  }
}

/**
 * Handle token request
 */
async function handleToken(
  req: Request,
  res: Response,
  provider: OIDCProvider,
): Promise<void> {
  // Get client credentials from Authorization header or body
  let clientId = req.body?.client_id;
  let clientSecret = req.body?.client_secret;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Basic ")) {
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, "base64").toString(
      "utf8",
    );
    const [id, secret] = credentials.split(":");
    clientId = clientId || decodeURIComponent(id);
    clientSecret = clientSecret || decodeURIComponent(secret);
  }

  const params: TokenRequest = {
    grant_type: req.body?.grant_type,
    code: req.body?.code,
    redirect_uri: req.body?.redirect_uri,
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: req.body?.refresh_token,
    scope: req.body?.scope,
    code_verifier: req.body?.code_verifier,
    client_assertion: req.body?.client_assertion,
    client_assertion_type: req.body?.client_assertion_type,
  };

  // Validate client authentication (supports client_secret_jwt, private_key_jwt, etc.)
  const authResult = await provider.validateClientAuth(params, clientId);
  if (!authResult.valid) {
    res.status(401).json({
      error: authResult.error || "invalid_client",
      error_description: authResult.errorDescription,
    });
    return;
  }

  const result = await provider.handleTokenRequest(params);

  if ("error" in result) {
    res.status(400).json(result);
  } else {
    res.json(result);
  }
}

/**
 * Handle userinfo request
 */
async function handleUserInfo(
  req: Request,
  res: Response,
  provider: OIDCProvider,
): Promise<void> {
  // Get access token from Authorization header or body
  let accessToken: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.slice(7);
  } else {
    accessToken = req.body?.access_token;
  }

  if (!accessToken) {
    res.status(401).json({
      error: "invalid_token",
      error_description: "Missing access token",
    });
    return;
  }

  // Use signed userinfo handler which returns JWT or JSON based on RP config
  const result = await provider.handleUserInfoRequestSigned(accessToken);

  if ("error" in result) {
    res.status(401).json(result);
  } else {
    res.setHeader("Content-Type", result.contentType);
    if (typeof result.response === "string") {
      res.send(result.response);
    } else {
      res.json(result.response);
    }
  }
}

/**
 * Handle introspection request
 */
async function handleIntrospection(
  req: Request,
  res: Response,
  provider: OIDCProvider,
): Promise<void> {
  // TODO: Validate client authentication

  const token = req.body?.token;
  const tokenTypeHint = req.body?.token_type_hint;

  if (!token) {
    res
      .status(400)
      .json({ error: "invalid_request", error_description: "Missing token" });
    return;
  }

  const result = await provider.handleIntrospectionRequest(
    token,
    tokenTypeHint,
  );
  res.json(result);
}

/**
 * Handle revocation request
 */
async function handleRevocation(
  req: Request,
  res: Response,
  provider: OIDCProvider,
): Promise<void> {
  // TODO: Validate client authentication

  const token = req.body?.token;

  if (!token) {
    res
      .status(400)
      .json({ error: "invalid_request", error_description: "Missing token" });
    return;
  }

  await provider.handleRevocationRequest(token, req.body?.token_type_hint);
  res.status(200).end();
}

/**
 * Handle end session request
 */
async function handleEndSession(
  req: Request,
  res: Response,
  options: OIDCRouterOptions,
): Promise<void> {
  const { provider, renderLogout } = options;

  const postLogoutRedirectUri = (req.query.post_logout_redirect_uri ||
    req.body?.post_logout_redirect_uri) as string;
  const idTokenHint = (req.query.id_token_hint ||
    req.body?.id_token_hint) as string;
  const clientId = (req.query.client_id || req.body?.client_id) as string;
  const state = (req.query.state || req.body?.state) as string;

  // Validate logout request
  const validation = provider.validateLogoutRequest({
    post_logout_redirect_uri: postLogoutRedirectUri,
    id_token_hint: idTokenHint,
    client_id: clientId,
  });

  if (!validation.valid) {
    // Return error response
    res.status(validation.errorCode === 108 ? 400 : 401).json({
      error: "invalid_request",
      error_description: validation.error,
    });
    return;
  }

  // If bypassConfirm is true and redirect URI is valid, redirect directly
  if (validation.bypassConfirm && postLogoutRedirectUri) {
    const redirectUrl = state
      ? `${postLogoutRedirectUri}${postLogoutRedirectUri.includes("?") ? "&" : "?"}state=${encodeURIComponent(state)}`
      : postLogoutRedirectUri;
    res.redirect(redirectUrl);
    return;
  }

  // Show logout confirmation or proceed with logout
  if (renderLogout) {
    renderLogout(req, res, postLogoutRedirectUri);
  } else if (postLogoutRedirectUri) {
    const redirectUrl = state
      ? `${postLogoutRedirectUri}${postLogoutRedirectUri.includes("?") ? "&" : "?"}state=${encodeURIComponent(state)}`
      : postLogoutRedirectUri;
    res.redirect(redirectUrl);
  } else {
    res.status(200).send("Logged out");
  }
}

/**
 * Redirect with parameters
 */
function redirectWithParams(
  res: Response,
  redirectUri: string,
  params: Record<string, string>,
  responseMode: "query" | "fragment" | "form_post" = "query",
): void {
  const url = new URL(redirectUri);

  if (responseMode === "form_post") {
    // Send as form POST
    const inputs = Object.entries(params)
      .map(
        ([key, value]) =>
          `<input type="hidden" name="${key}" value="${escapeHtml(value)}"/>`,
      )
      .join("");

    res.setHeader("Content-Type", "text/html");
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Redirect</title></head>
      <body onload="document.forms[0].submit()">
        <form method="post" action="${escapeHtml(redirectUri)}">
          ${inputs}
          <noscript><button type="submit">Continue</button></noscript>
        </form>
      </body>
      </html>
    `);
  } else {
    // Redirect with query or fragment
    const searchParams = new URLSearchParams(params);

    if (responseMode === "fragment") {
      url.hash = searchParams.toString();
    } else {
      // Append to existing query params
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
      }
    }

    res.redirect(url.toString());
  }
}

/**
 * Redirect with error
 */
function redirectWithError(
  res: Response,
  redirectUri: string | undefined,
  error: { error: string; error_description?: string },
  state?: string,
  responseMode?: "query" | "fragment" | "form_post",
): void {
  if (!redirectUri) {
    res.status(400).json(error);
    return;
  }

  const params: Record<string, string> = { error: error.error };
  if (error.error_description) {
    params.error_description = error.error_description;
  }
  if (state) {
    params.state = state;
  }

  redirectWithParams(res, redirectUri, params, responseMode || "query");
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Handle Dynamic Client Registration request
 */
async function handleRegistration(
  req: Request,
  res: Response,
  provider: OIDCProvider,
): Promise<void> {
  // Check content type
  const contentType = req.headers["content-type"];
  if (!contentType?.includes("application/json")) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "Content-Type must be application/json",
    });
    return;
  }

  // Get client metadata from request body
  const clientMetadata = req.body as ClientRegistrationRequest;

  if (!clientMetadata || typeof clientMetadata !== "object") {
    res.status(400).json({
      error: "invalid_client_metadata",
      error_description: "Missing or invalid request body",
    });
    return;
  }

  // Get source IP for logging
  const sourceIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    req.ip;

  const result = await provider.handleRegistration(clientMetadata, sourceIp);

  if ("error" in result) {
    // Error response
    const statusCode =
      result.error === "server_error"
        ? 500
        : result.error === "invalid_redirect_uri" ||
            result.error === "invalid_client_metadata"
          ? 400
          : 400;
    res.status(statusCode).json(result);
  } else {
    // Success response with 201 Created
    res.status(201).json(result);
  }
}

export default createOIDCRouter;
