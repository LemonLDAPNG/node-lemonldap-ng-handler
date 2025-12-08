/**
 * OIDC helpers for proxy integration tests
 */

import * as crypto from "crypto";

/**
 * Generate a random state parameter
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Generate a random nonce parameter
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Generate PKCE code verifier and challenge
 */
export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

/**
 * Build OIDC authorization URL
 */
export function buildAuthorizeUrl(config: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  state?: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  responseType?: string;
}): string {
  const params = new URLSearchParams({
    response_type: config.responseType || "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope || "openid profile email",
    state: config.state || generateState(),
    nonce: config.nonce || generateNonce(),
  });

  if (config.codeChallenge) {
    params.set("code_challenge", config.codeChallenge);
    params.set("code_challenge_method", config.codeChallengeMethod || "S256");
  }

  return `${config.issuer}/oauth2/authorize?${params.toString()}`;
}

/**
 * Parse an ID token (without verification)
 */
export function parseIdToken(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
} | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());

    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Build token request body
 */
export function buildTokenRequest(config: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string;
  codeVerifier?: string;
  grantType?: string;
}): URLSearchParams {
  const params = new URLSearchParams({
    grant_type: config.grantType || "authorization_code",
    code: config.code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
  });

  if (config.clientSecret) {
    params.set("client_secret", config.clientSecret);
  }

  if (config.codeVerifier) {
    params.set("code_verifier", config.codeVerifier);
  }

  return params;
}

/**
 * Build logout URL
 */
export function buildLogoutUrl(config: {
  issuer: string;
  idTokenHint?: string;
  postLogoutRedirectUri?: string;
  state?: string;
}): string {
  const params = new URLSearchParams();

  if (config.idTokenHint) {
    params.set("id_token_hint", config.idTokenHint);
  }

  if (config.postLogoutRedirectUri) {
    params.set("post_logout_redirect_uri", config.postLogoutRedirectUri);
  }

  if (config.state) {
    params.set("state", config.state);
  }

  const queryString = params.toString();
  return `${config.issuer}/oauth2/logout${queryString ? `?${queryString}` : ""}`;
}

/**
 * OIDC RP configuration for tests
 */
export interface OIDCRPConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string;
  usePKCE?: boolean;
}

/**
 * OIDC OP configuration for tests
 */
export interface OIDCOPConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes?: string[];
  bypassConsent?: boolean;
}

/**
 * Create OIDC RP metadata configuration
 */
export function createOIDCRPMetaData(
  confKey: string,
  opUrl: string,
  config: OIDCRPConfig,
): Record<string, unknown> {
  return {
    oidcOPMetaData: {
      [confKey]: {
        confKey,
        oidcOPMetaDataOptions: {
          oidcOPMetaDataOptionsClientID: config.clientId,
          oidcOPMetaDataOptionsClientSecret: config.clientSecret,
          oidcOPMetaDataOptionsConfigurationURI: `${opUrl}/.well-known/openid-configuration`,
          oidcOPMetaDataOptionsAuthorizeURI: `${opUrl}/oauth2/authorize`,
          oidcOPMetaDataOptionsTokenURI: `${opUrl}/oauth2/token`,
          oidcOPMetaDataOptionsUserInfoURI: `${opUrl}/oauth2/userinfo`,
          oidcOPMetaDataOptionsScope: config.scope || "openid profile email",
          oidcOPMetaDataOptionsUsePKCE: config.usePKCE ?? true,
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
  };
}

/**
 * Create OIDC OP (issuer) configuration
 */
export function createOIDCOPConfig(
  confKey: string,
  config: OIDCOPConfig,
  privateKey: string,
  keyId: string,
): Record<string, unknown> {
  return {
    issuerDBOpenIDConnectActivation: true,
    oidcServiceMetaDataIssuer: config.issuer,
    oidcServicePrivateKeySig: privateKey,
    oidcServiceKeyIdSig: keyId,
    oidcRPMetaDataOptions: {
      [confKey]: {
        oidcRPMetaDataOptionsClientID: config.clientId,
        oidcRPMetaDataOptionsClientSecret: config.clientSecret,
        oidcRPMetaDataOptionsRedirectUris: config.redirectUris,
        oidcRPMetaDataOptionsBypassConsent: config.bypassConsent ?? true,
        oidcRPMetaDataOptionsIDTokenExpiration: 3600,
        oidcRPMetaDataOptionsAccessTokenExpiration: 3600,
        oidcRPMetaDataOptionsIDTokenSignAlg: "RS256",
      },
    },
    oidcRPMetaDataExportedVars: {
      [confKey]: {
        email: "mail",
        family_name: "sn",
        given_name: "givenName",
        name: "cn",
      },
    },
  };
}
