/**
 * OIDC Provider (Issuer)
 *
 * Implements OpenID Connect Provider functionality
 */

import * as jose from "jose";
import {
  KeyManager,
  KeyManagerConfig,
  computeAtHash,
  generateRandomString,
  verifyCodeChallenge,
  Logger,
} from "@lemonldap-ng/lib-oidc";
import {
  OIDCProviderConfig,
  OIDCDiscoveryMetadata,
  TokenResponse,
  TokenErrorResponse,
  IntrospectionResponse,
  AuthorizationRequest,
  TokenRequest,
  AuthCodeData,
  AccessTokenData,
  RefreshTokenData,
  OIDCRPOptions,
  OIDCRPExportedVars,
  ClientRegistrationRequest,
  ClientRegistrationResponse,
  ClientRegistrationErrorResponse,
} from "./types";

/**
 * Default configuration values
 */
const DEFAULTS = {
  oidcServiceMetaDataAuthorizeURI: "authorize",
  oidcServiceMetaDataTokenURI: "token",
  oidcServiceMetaDataUserInfoURI: "userinfo",
  oidcServiceMetaDataJWKSURI: "jwks",
  oidcServiceMetaDataRegistrationURI: "register",
  oidcServiceMetaDataIntrospectionURI: "introspect",
  oidcServiceMetaDataRevokeURI: "revoke",
  oidcServiceMetaDataEndSessionURI: "logout",
  oidcServiceMetaDataCheckSessionURI: "checksession.html",
  oidcServiceMetaDataFrontChannelURI: "flogout",
  oidcServiceMetaDataBackChannelURI: "blogout",
  oidcServiceAllowAuthorizationCodeFlow: true,
  oidcServiceAllowImplicitFlow: false,
  oidcServiceAllowHybridFlow: false,
  oidcServiceAuthorizationCodeExpiration: 60,
  oidcServiceIDTokenExpiration: 3600,
  oidcServiceAccessTokenExpiration: 3600,
  oidcServiceOfflineSessionExpiration: 2592000,
  oidcServiceEncAlgorithmAlg: "RSA-OAEP",
  oidcServiceEncAlgorithmEnc: "A256GCM",
};

/**
 * Default logger (console)
 */
const defaultLogger: Logger = {
  error: (...args) => console.error("[OIDC]", ...args),
  warn: (...args) => console.warn("[OIDC]", ...args),
  notice: (...args) => console.log("[OIDC]", ...args),
  info: (...args) => console.info("[OIDC]", ...args),
  debug: (...args) => console.debug("[OIDC]", ...args),
};

/**
 * In-memory token store (for development/testing)
 */
class InMemoryTokenStore {
  private authCodes = new Map<string, AuthCodeData>();
  private accessTokens = new Map<string, AccessTokenData>();
  private refreshTokens = new Map<string, RefreshTokenData>();

  async storeAuthCode(code: string, data: AuthCodeData): Promise<void> {
    this.authCodes.set(code, data);
  }

  async consumeAuthCode(code: string): Promise<AuthCodeData | null> {
    const data = this.authCodes.get(code);
    if (data) {
      this.authCodes.delete(code);
      return data;
    }
    return null;
  }

  async storeAccessToken(token: string, data: AccessTokenData): Promise<void> {
    this.accessTokens.set(token, data);
  }

  async getAccessToken(token: string): Promise<AccessTokenData | null> {
    return this.accessTokens.get(token) || null;
  }

  async revokeAccessToken(token: string): Promise<void> {
    this.accessTokens.delete(token);
  }

  async storeRefreshToken(
    token: string,
    data: RefreshTokenData,
  ): Promise<void> {
    this.refreshTokens.set(token, data);
  }

  async getRefreshToken(token: string): Promise<RefreshTokenData | null> {
    return this.refreshTokens.get(token) || null;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    this.refreshTokens.delete(token);
  }
}

/**
 * Cached JWKS entry with TTL
 */
interface JWKSCacheEntry {
  jwks: jose.JSONWebKeySet;
  expiresAt: number;
}

/**
 * OIDC Provider class
 */
export class OIDCProvider {
  private config: OIDCProviderConfig;
  private logger: Logger;
  private keyManager: KeyManager;
  private tokenStore: InMemoryTokenStore;
  private initialized = false;

  /** Cache for external JWKS (keyed by URL) with 5-minute TTL */
  private jwksCache = new Map<string, JWKSCacheEntry>();
  private static readonly JWKS_CACHE_TTL = 300; // 5 minutes

  constructor(config: OIDCProviderConfig) {
    this.config = { ...DEFAULTS, ...config };
    this.logger = config.logger || defaultLogger;
    this.tokenStore = new InMemoryTokenStore();

    // Build KeyManager config
    const keyConfig: KeyManagerConfig = {
      oidcServicePrivateKeySig: config.oidcServicePrivateKeySig,
      oidcServicePublicKeySig: config.oidcServicePublicKeySig,
      oidcServiceKeyIdSig: config.oidcServiceKeyIdSig,
      oidcServiceKeyTypeSig: config.oidcServiceKeyTypeSig,
      oidcServicePrivateKeyEnc: config.oidcServicePrivateKeyEnc,
      oidcServicePublicKeyEnc: config.oidcServicePublicKeyEnc,
      oidcServiceKeyTypeEnc: config.oidcServiceKeyTypeEnc,
      oidcServiceOldPrivateKeyEnc: config.oidcServiceOldPrivateKeyEnc,
      oidcServiceOldPublicKeyEnc: config.oidcServiceOldPublicKeyEnc,
      oidcServiceOldKeyTypeEnc: config.oidcServiceOldKeyTypeEnc,
    };

    this.keyManager = new KeyManager(keyConfig, this.logger);
  }

  /**
   * Initialize the provider
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    await this.keyManager.init();
    this.initialized = true;
    this.logger.info("OIDC Provider initialized");
  }

  /**
   * Get the issuer URL
   */
  getIssuer(): string {
    return this.config.oidcServiceMetaDataIssuer || this.config.portal || "";
  }

  /**
   * Get RP configuration by client_id
   */
  getRP(clientId: string): OIDCRPOptions | null {
    const rpConfigs = this.config.oidcRPMetaDataOptions || {};
    for (const [, options] of Object.entries(rpConfigs)) {
      if (options.oidcRPMetaDataOptionsClientID === clientId) {
        return options;
      }
    }
    return null;
  }

  /**
   * Get RP confKey by client_id
   */
  private getRPConfKey(clientId: string): string | null {
    const rpConfigs = this.config.oidcRPMetaDataOptions || {};
    for (const [confKey, options] of Object.entries(rpConfigs)) {
      if (options.oidcRPMetaDataOptionsClientID === clientId) {
        return confKey;
      }
    }
    return null;
  }

  /**
   * Fetch JWKS from URL or parse inline JSON with caching
   * @param jwksSource URL or JSON string of JWKS
   * @returns Parsed JWKS or null on error
   */
  private async fetchJWKS(
    jwksSource: string,
  ): Promise<jose.JSONWebKeySet | null> {
    const now = Math.floor(Date.now() / 1000);

    // Check if it's a URL
    const isUrl =
      jwksSource.startsWith("http://") || jwksSource.startsWith("https://");

    if (isUrl) {
      // Check cache
      const cached = this.jwksCache.get(jwksSource);
      if (cached && cached.expiresAt > now) {
        return cached.jwks;
      }

      // Fetch from URL
      try {
        const response = await fetch(jwksSource);
        if (!response.ok) {
          this.logger.warn(
            `Failed to fetch JWKS from ${jwksSource}: ${response.status}`,
          );
          return null;
        }
        const jwks = (await response.json()) as jose.JSONWebKeySet;

        // Cache the result
        this.jwksCache.set(jwksSource, {
          jwks,
          expiresAt: now + OIDCProvider.JWKS_CACHE_TTL,
        });

        return jwks;
      } catch (err) {
        this.logger.error(`Error fetching JWKS from ${jwksSource}: ${err}`);
        return null;
      }
    } else {
      // Parse inline JWKS JSON
      try {
        return JSON.parse(jwksSource) as jose.JSONWebKeySet;
      } catch (err) {
        this.logger.error(`Error parsing inline JWKS: ${err}`);
        return null;
      }
    }
  }

  /**
   * Find a key in JWKS by usage and optionally kid
   */
  private findKeyInJWKS(
    jwks: jose.JSONWebKeySet,
    use: "sig" | "enc",
    kid?: string,
  ): jose.JWK | null {
    // First try to find a key with matching use and kid
    let key = jwks.keys.find(
      (k) => (k.use === use || !k.use) && (!kid || k.kid === kid),
    );

    if (!key && use === "enc") {
      // For encryption, try any RSA key as fallback
      key = jwks.keys.find((k) => k.kty === "RSA" && (!kid || k.kid === kid));
    }

    return key || null;
  }

  /**
   * Build endpoint URL
   */
  private buildEndpointUrl(endpoint: string): string {
    const issuer = this.getIssuer().replace(/\/$/, "");
    const basePath = (this.config.basePath || "").replace(/\/$/, "");
    return `${issuer}${basePath}/${endpoint}`;
  }

  /**
   * Generate OpenID Connect Discovery Metadata
   */
  getDiscoveryMetadata(): OIDCDiscoveryMetadata {
    const issuer = this.getIssuer();
    const config = this.config;

    const responseTypesSupported: string[] = [];
    if (config.oidcServiceAllowAuthorizationCodeFlow) {
      responseTypesSupported.push("code");
    }
    if (config.oidcServiceAllowImplicitFlow) {
      responseTypesSupported.push("id_token", "id_token token");
    }
    if (config.oidcServiceAllowHybridFlow) {
      responseTypesSupported.push(
        "code id_token",
        "code token",
        "code id_token token",
      );
    }

    const grantTypesSupported = ["authorization_code"];
    if (config.oidcServiceAllowImplicitFlow) {
      grantTypesSupported.push("implicit");
    }
    grantTypesSupported.push("refresh_token");

    const sigAlgsSupported = [
      "RS256",
      "RS384",
      "RS512",
      "ES256",
      "ES384",
      "ES512",
    ];
    if (!config.oidcServiceMetaDataDisallowNoneAlg) {
      sigAlgsSupported.push("none");
    }

    return {
      issuer,
      authorization_endpoint: this.buildEndpointUrl(
        config.oidcServiceMetaDataAuthorizeURI!,
      ),
      token_endpoint: this.buildEndpointUrl(
        config.oidcServiceMetaDataTokenURI!,
      ),
      userinfo_endpoint: this.buildEndpointUrl(
        config.oidcServiceMetaDataUserInfoURI!,
      ),
      jwks_uri: this.buildEndpointUrl(config.oidcServiceMetaDataJWKSURI!),
      registration_endpoint: config.oidcServiceAllowDynamicRegistration
        ? this.buildEndpointUrl(config.oidcServiceMetaDataRegistrationURI!)
        : undefined,
      introspection_endpoint: this.buildEndpointUrl(
        config.oidcServiceMetaDataIntrospectionURI!,
      ),
      revocation_endpoint: this.buildEndpointUrl(
        config.oidcServiceMetaDataRevokeURI!,
      ),
      end_session_endpoint: this.buildEndpointUrl(
        config.oidcServiceMetaDataEndSessionURI!,
      ),
      check_session_iframe: this.buildEndpointUrl(
        config.oidcServiceMetaDataCheckSessionURI!,
      ),
      frontchannel_logout_supported: true,
      frontchannel_logout_session_supported: true,
      backchannel_logout_supported: true,
      backchannel_logout_session_supported: true,
      scopes_supported: [
        "openid",
        "profile",
        "email",
        "address",
        "phone",
        "offline_access",
      ],
      response_types_supported: responseTypesSupported,
      response_modes_supported: ["query", "fragment", "form_post"],
      grant_types_supported: grantTypesSupported,
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: sigAlgsSupported,
      id_token_encryption_alg_values_supported: [
        "RSA-OAEP",
        "RSA-OAEP-256",
        "A128KW",
        "A256KW",
      ],
      id_token_encryption_enc_values_supported: [
        "A128CBC-HS256",
        "A256CBC-HS512",
        "A128GCM",
        "A256GCM",
      ],
      userinfo_signing_alg_values_supported: sigAlgsSupported,
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "client_secret_jwt",
        "private_key_jwt",
        "none",
      ],
      token_endpoint_auth_signing_alg_values_supported: [
        "HS256",
        "HS384",
        "HS512",
        "RS256",
        "ES256",
      ],
      claims_supported: [
        "sub",
        "iss",
        "auth_time",
        "acr",
        "name",
        "given_name",
        "family_name",
        "nickname",
        "preferred_username",
        "profile",
        "picture",
        "website",
        "email",
        "email_verified",
        "gender",
        "birthdate",
        "zoneinfo",
        "locale",
        "phone_number",
        "phone_number_verified",
        "address",
        "updated_at",
      ],
      claims_parameter_supported: true,
      request_parameter_supported: true,
      request_uri_parameter_supported: true,
      code_challenge_methods_supported: ["S256", "plain"],
    };
  }

  /**
   * Get JWKS (JSON Web Key Set)
   */
  async getJWKS(): Promise<{ keys: unknown[] }> {
    return this.keyManager.buildJWKS();
  }

  /**
   * Validate authorization request
   */
  validateAuthorizationRequest(
    params: AuthorizationRequest,
  ): TokenErrorResponse | null {
    // Check required parameters
    if (!params.client_id) {
      return {
        error: "invalid_request",
        error_description: "Missing client_id",
      };
    }
    if (!params.response_type) {
      return {
        error: "invalid_request",
        error_description: "Missing response_type",
      };
    }
    if (!params.redirect_uri) {
      return {
        error: "invalid_request",
        error_description: "Missing redirect_uri",
      };
    }

    // Get RP configuration
    const rp = this.getRP(params.client_id);
    if (!rp) {
      return {
        error: "unauthorized_client",
        error_description: "Unknown client_id",
      };
    }

    // Validate redirect_uri
    const allowedUris = rp.oidcRPMetaDataOptionsRedirectUris || [];
    if (allowedUris.length > 0 && !allowedUris.includes(params.redirect_uri)) {
      return {
        error: "invalid_request",
        error_description: "Invalid redirect_uri",
      };
    }

    // Validate response_type
    const responseTypes = params.response_type.split(" ");
    if (
      responseTypes.includes("code") &&
      !this.config.oidcServiceAllowAuthorizationCodeFlow
    ) {
      return {
        error: "unsupported_response_type",
        error_description: "code flow not allowed",
      };
    }
    if (
      responseTypes.includes("token") &&
      !this.config.oidcServiceAllowImplicitFlow
    ) {
      return {
        error: "unsupported_response_type",
        error_description: "implicit flow not allowed",
      };
    }

    // Validate PKCE if required
    if (rp.oidcRPMetaDataOptionsRequirePKCE) {
      if (!params.code_challenge) {
        return { error: "invalid_request", error_description: "PKCE required" };
      }
      if (
        params.code_challenge_method === "plain" &&
        !rp.oidcRPMetaDataOptionsAllowPKCEPlain
      ) {
        return {
          error: "invalid_request",
          error_description: "plain PKCE method not allowed",
        };
      }
    }

    // Require scope to contain openid
    if (params.scope && !params.scope.split(" ").includes("openid")) {
      return {
        error: "invalid_scope",
        error_description: "openid scope required",
      };
    }

    return null;
  }

  /**
   * Generate authorization code
   */
  async generateAuthorizationCode(
    request: AuthorizationRequest,
    userId: string,
    sessionId: string,
  ): Promise<string> {
    const code = generateRandomString(32);
    const now = Math.floor(Date.now() / 1000);
    const expiration = this.config.oidcServiceAuthorizationCodeExpiration || 60;

    const codeData: AuthCodeData = {
      clientId: request.client_id,
      redirectUri: request.redirect_uri,
      scope: request.scope || "openid",
      userId,
      sessionId,
      nonce: request.nonce,
      state: request.state,
      codeChallenge: request.code_challenge,
      codeChallengeMethod: request.code_challenge_method,
      authTime: now,
      createdAt: now,
      expiresAt: now + expiration,
    };

    const storeFunc =
      this.config.storeAuthCode ||
      this.tokenStore.storeAuthCode.bind(this.tokenStore);
    await storeFunc(code, codeData);

    return code;
  }

  /**
   * Handle token request
   */
  async handleTokenRequest(
    params: TokenRequest,
  ): Promise<TokenResponse | TokenErrorResponse> {
    const { grant_type } = params;

    switch (grant_type) {
      case "authorization_code":
        return this.handleAuthorizationCodeGrant(params);
      case "refresh_token":
        return this.handleRefreshTokenGrant(params);
      case "client_credentials":
        return this.handleClientCredentialsGrant(params);
      default:
        return {
          error: "unsupported_grant_type",
          error_description: `Unsupported grant_type: ${grant_type}`,
        };
    }
  }

  /**
   * Handle authorization_code grant
   */
  private async handleAuthorizationCodeGrant(
    params: TokenRequest,
  ): Promise<TokenResponse | TokenErrorResponse> {
    const { code, redirect_uri, client_id, client_secret, code_verifier } =
      params;

    if (!code) {
      return { error: "invalid_request", error_description: "Missing code" };
    }
    if (!redirect_uri) {
      return {
        error: "invalid_request",
        error_description: "Missing redirect_uri",
      };
    }

    // Consume authorization code
    const consumeFunc =
      this.config.consumeAuthCode ||
      this.tokenStore.consumeAuthCode.bind(this.tokenStore);
    const codeData = await consumeFunc(code);

    if (!codeData) {
      return {
        error: "invalid_grant",
        error_description: "Invalid or expired authorization code",
      };
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (codeData.expiresAt < now) {
      return {
        error: "invalid_grant",
        error_description: "Authorization code expired",
      };
    }

    // Validate redirect_uri
    if (codeData.redirectUri !== redirect_uri) {
      return {
        error: "invalid_grant",
        error_description: "redirect_uri mismatch",
      };
    }

    // Validate client_id
    if (client_id && codeData.clientId !== client_id) {
      return {
        error: "invalid_grant",
        error_description: "client_id mismatch",
      };
    }

    // Validate client credentials
    const rp = this.getRP(codeData.clientId);
    if (!rp) {
      return { error: "invalid_client", error_description: "Unknown client" };
    }

    // Check client secret for confidential clients
    if (
      !rp.oidcRPMetaDataOptionsPublic &&
      rp.oidcRPMetaDataOptionsClientSecret
    ) {
      if (client_secret !== rp.oidcRPMetaDataOptionsClientSecret) {
        return {
          error: "invalid_client",
          error_description: "Invalid client credentials",
        };
      }
    }

    // Validate PKCE
    if (codeData.codeChallenge) {
      if (!code_verifier) {
        return {
          error: "invalid_grant",
          error_description: "Missing code_verifier",
        };
      }
      const method = codeData.codeChallengeMethod || "S256";
      if (!verifyCodeChallenge(codeData.codeChallenge, code_verifier, method)) {
        return {
          error: "invalid_grant",
          error_description: "Invalid code_verifier",
        };
      }
    }

    // Generate tokens
    return this.generateTokens(
      codeData.clientId,
      codeData.userId,
      codeData.sessionId,
      codeData.scope,
      codeData.nonce,
    );
  }

  /**
   * Handle refresh_token grant
   */
  private async handleRefreshTokenGrant(
    params: TokenRequest,
  ): Promise<TokenResponse | TokenErrorResponse> {
    const { refresh_token, scope } = params;

    if (!refresh_token) {
      return {
        error: "invalid_request",
        error_description: "Missing refresh_token",
      };
    }

    // Get refresh token data
    const getFunc =
      this.config.getRefreshToken ||
      this.tokenStore.getRefreshToken.bind(this.tokenStore);
    const tokenData = await getFunc(refresh_token);

    if (!tokenData) {
      return {
        error: "invalid_grant",
        error_description: "Invalid refresh token",
      };
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (tokenData.expiresAt < now) {
      return {
        error: "invalid_grant",
        error_description: "Refresh token expired",
      };
    }

    // Use requested scope or original scope
    const newScope = scope || tokenData.scope;

    // Revoke old refresh token if rotation is enabled
    const rp = this.getRP(tokenData.clientId);
    if (rp?.oidcRPMetaDataOptionsRefreshTokenRotation) {
      const revokeFunc =
        this.config.revokeRefreshToken ||
        this.tokenStore.revokeRefreshToken.bind(this.tokenStore);
      await revokeFunc(refresh_token);
    }

    // Generate new tokens
    return this.generateTokens(
      tokenData.clientId,
      tokenData.userId,
      tokenData.sessionId,
      newScope,
    );
  }

  /**
   * Handle client_credentials grant
   */
  private async handleClientCredentialsGrant(
    params: TokenRequest,
  ): Promise<TokenResponse | TokenErrorResponse> {
    const { client_id, client_secret, scope } = params;

    if (!client_id || !client_secret) {
      return {
        error: "invalid_client",
        error_description: "Missing client credentials",
      };
    }

    const rp = this.getRP(client_id);
    if (!rp) {
      return { error: "invalid_client", error_description: "Unknown client" };
    }

    if (rp.oidcRPMetaDataOptionsClientSecret !== client_secret) {
      return {
        error: "invalid_client",
        error_description: "Invalid client credentials",
      };
    }

    // Check if client_credentials grant is allowed for this client
    if (!rp.oidcRPMetaDataOptionsAllowClientCredentialsGrant) {
      return {
        error: "unauthorized_client",
        error_description:
          "Client credentials grant not allowed for this client",
      };
    }

    // Generate access token only (no id_token for client_credentials)
    const now = Math.floor(Date.now() / 1000);
    const accessTokenExpiration =
      rp.oidcRPMetaDataOptionsAccessTokenExpiration ||
      this.config.oidcServiceAccessTokenExpiration ||
      3600;

    const accessToken = generateRandomString(32);
    const tokenData: AccessTokenData = {
      clientId: client_id,
      userId: client_id, // For client_credentials, client is the subject
      sessionId: "",
      scope: scope || "",
      createdAt: now,
      expiresAt: now + accessTokenExpiration,
    };

    const storeFunc =
      this.config.storeAccessToken ||
      this.tokenStore.storeAccessToken.bind(this.tokenStore);
    await storeFunc(accessToken, tokenData);

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: accessTokenExpiration,
      scope: scope || undefined,
    };
  }

  /**
   * Generate access token, id_token, and optionally refresh token
   */
  private async generateTokens(
    clientId: string,
    userId: string,
    sessionId: string,
    scope: string,
    nonce?: string,
  ): Promise<TokenResponse> {
    const now = Math.floor(Date.now() / 1000);
    const rp = this.getRP(clientId);

    // Get expiration times
    const accessTokenExpiration =
      rp?.oidcRPMetaDataOptionsAccessTokenExpiration ||
      this.config.oidcServiceAccessTokenExpiration ||
      3600;
    const idTokenExpiration =
      rp?.oidcRPMetaDataOptionsIDTokenExpiration ||
      this.config.oidcServiceIDTokenExpiration ||
      3600;

    // Generate access token
    let accessToken: string;
    const jti = generateRandomString(16);

    if (rp?.oidcRPMetaDataOptionsAccessTokenFormat === "jwt") {
      // JWT access token
      accessToken = await this.keyManager.signJWT(
        {
          iss: this.getIssuer(),
          sub: userId,
          aud: clientId,
          exp: now + accessTokenExpiration,
          iat: now,
          jti,
          client_id: clientId,
          scope,
        },
        { typ: "at+jwt" },
      );
    } else {
      // Opaque access token
      accessToken = generateRandomString(32);
    }

    // Store access token data
    const accessTokenData: AccessTokenData = {
      clientId,
      userId,
      sessionId,
      scope,
      createdAt: now,
      expiresAt: now + accessTokenExpiration,
      jti,
    };

    const storeAccessFunc =
      this.config.storeAccessToken ||
      this.tokenStore.storeAccessToken.bind(this.tokenStore);
    await storeAccessFunc(accessToken, accessTokenData);

    // Get user claims for ID token
    let userClaims: Record<string, unknown> = {};
    if (this.config.getSession) {
      const session = await this.config.getSession(sessionId);
      if (session) {
        userClaims = this.getUserClaims(clientId, session, scope);
      }
    }

    // Generate ID token
    const signingKey = this.keyManager.getSigningKey();
    const idTokenPayload = {
      iss: this.getIssuer(),
      sub: userId,
      aud: clientId,
      exp: now + idTokenExpiration,
      iat: now,
      auth_time: now,
      nonce,
      at_hash: signingKey
        ? computeAtHash(accessToken, signingKey.alg)
        : undefined,
      ...userClaims,
    };

    const idToken = await this.signAndEncryptIdToken(idTokenPayload, clientId);

    // Build response
    const response: TokenResponse = {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: accessTokenExpiration,
      id_token: idToken,
      scope,
    };

    // Generate refresh token if offline_access scope is present
    if (
      scope.split(" ").includes("offline_access") &&
      rp?.oidcRPMetaDataOptionsAllowOffline !== false
    ) {
      const refreshToken = generateRandomString(32);
      const refreshTokenExpiration =
        rp?.oidcRPMetaDataOptionsOfflineSessionExpiration ||
        this.config.oidcServiceOfflineSessionExpiration ||
        2592000;

      const refreshTokenData: RefreshTokenData = {
        clientId,
        userId,
        sessionId,
        scope,
        createdAt: now,
        expiresAt: now + refreshTokenExpiration,
      };

      const storeRefreshFunc =
        this.config.storeRefreshToken ||
        this.tokenStore.storeRefreshToken.bind(this.tokenStore);
      await storeRefreshFunc(refreshToken, refreshTokenData);

      response.refresh_token = refreshToken;
    }

    return response;
  }

  /**
   * Generate tokens for implicit/hybrid flow
   * Unlike generateTokens, this doesn't require an authorization code
   */
  async generateTokensForImplicit(
    request: AuthorizationRequest,
    userId: string,
    sessionId: string,
    options: {
      includeAccessToken: boolean;
      includeIdToken: boolean;
    },
  ): Promise<{
    access_token?: string;
    id_token?: string;
    token_type?: string;
    expires_in?: number;
  }> {
    const now = Math.floor(Date.now() / 1000);
    const rp = this.getRP(request.client_id);
    const scope = request.scope || "openid";

    const result: {
      access_token?: string;
      id_token?: string;
      token_type?: string;
      expires_in?: number;
    } = {};

    // Get expiration times
    const accessTokenExpiration =
      rp?.oidcRPMetaDataOptionsAccessTokenExpiration ||
      this.config.oidcServiceAccessTokenExpiration ||
      3600;
    const idTokenExpiration =
      rp?.oidcRPMetaDataOptionsIDTokenExpiration ||
      this.config.oidcServiceIDTokenExpiration ||
      3600;

    // Generate access token if requested
    if (options.includeAccessToken) {
      const jti = generateRandomString(16);
      let accessToken: string;

      if (rp?.oidcRPMetaDataOptionsAccessTokenFormat === "jwt") {
        accessToken = await this.keyManager.signJWT(
          {
            iss: this.getIssuer(),
            sub: userId,
            aud: request.client_id,
            exp: now + accessTokenExpiration,
            iat: now,
            jti,
            client_id: request.client_id,
            scope,
          },
          { typ: "at+jwt" },
        );
      } else {
        accessToken = generateRandomString(32);
      }

      // Store access token data
      const accessTokenData: AccessTokenData = {
        clientId: request.client_id,
        userId,
        sessionId,
        scope,
        createdAt: now,
        expiresAt: now + accessTokenExpiration,
        jti,
      };

      const storeAccessFunc =
        this.config.storeAccessToken ||
        this.tokenStore.storeAccessToken.bind(this.tokenStore);
      await storeAccessFunc(accessToken, accessTokenData);

      result.access_token = accessToken;
      result.token_type = "Bearer";
      result.expires_in = accessTokenExpiration;
    }

    // Generate ID token if requested
    if (options.includeIdToken) {
      // Get user claims for ID token
      let userClaims: Record<string, unknown> = {};
      if (this.config.getSession) {
        const session = await this.config.getSession(sessionId);
        if (session) {
          userClaims = this.getUserClaims(request.client_id, session, scope);
        }
      }

      const signingKey = this.keyManager.getSigningKey();
      const idTokenPayload: Record<string, unknown> = {
        iss: this.getIssuer(),
        sub: userId,
        aud: request.client_id,
        exp: now + idTokenExpiration,
        iat: now,
        auth_time: now,
        nonce: request.nonce,
        ...userClaims,
      };

      // Add at_hash if access token was generated
      if (result.access_token && signingKey) {
        idTokenPayload.at_hash = computeAtHash(
          result.access_token,
          signingKey.alg,
        );
      }

      result.id_token = await this.signAndEncryptIdToken(
        idTokenPayload,
        request.client_id,
      );
    }

    return result;
  }

  /**
   * Sign and optionally encrypt an ID token
   * If the RP has encryption configured, the signed JWT will be encrypted
   */
  private async signAndEncryptIdToken(
    payload: jose.JWTPayload,
    clientId: string,
  ): Promise<string> {
    // First, sign the ID token
    const signedToken = await this.keyManager.signJWT(payload);

    // Check if RP wants encryption
    const rp = this.getRP(clientId);
    if (!rp?.oidcRPMetaDataOptionsIDTokenEncAlg) {
      // No encryption requested
      return signedToken;
    }

    // Get RP's public key for encryption
    const rpPublicKey = await this.getRPEncryptionKey(clientId);
    if (!rpPublicKey) {
      this.logger.warn(
        `RP ${clientId} requested ID token encryption but no public key found`,
      );
      return signedToken;
    }

    // Encrypt the signed token
    const alg = rp.oidcRPMetaDataOptionsIDTokenEncAlg || "RSA-OAEP";
    const enc = rp.oidcRPMetaDataOptionsIDTokenEncEnc || "A256GCM";

    try {
      const jwe = await new jose.CompactEncrypt(
        new TextEncoder().encode(signedToken),
      )
        .setProtectedHeader({ alg, enc, cty: "JWT" })
        .encrypt(rpPublicKey);

      return jwe;
    } catch (err) {
      this.logger.error(`Failed to encrypt ID token for ${clientId}: ${err}`);
      return signedToken;
    }
  }

  /**
   * Get RP's public encryption key from their JWKS configuration
   * Uses cached JWKS fetch for better performance
   */
  private async getRPEncryptionKey(
    clientId: string,
  ): Promise<jose.KeyLike | null> {
    const rp = this.getRP(clientId);
    if (!rp?.oidcRPMetaDataOptionsJwks) {
      return null;
    }

    const jwks = await this.fetchJWKS(rp.oidcRPMetaDataOptionsJwks);
    if (!jwks) {
      return null;
    }

    const encKey = this.findKeyInJWKS(jwks, "enc");
    if (!encKey) {
      return null;
    }

    try {
      return (await jose.importJWK(encKey)) as jose.KeyLike;
    } catch (err) {
      this.logger.error(`Failed to import RP encryption key: ${err}`);
      return null;
    }
  }

  /**
   * Validate client authentication for token endpoint
   * Supports: client_secret_basic, client_secret_post, client_secret_jwt, private_key_jwt, none
   */
  async validateClientAuth(
    params: TokenRequest,
    clientId: string,
  ): Promise<{ valid: boolean; error?: string; errorDescription?: string }> {
    const rp = this.getRP(clientId);
    if (!rp) {
      return {
        valid: false,
        error: "invalid_client",
        errorDescription: "Unknown client",
      };
    }

    const authMethod =
      rp.oidcRPMetaDataOptionsTokenEndpointAuthMethod || "client_secret_basic";

    // Public clients with auth method "none"
    if (authMethod === "none" || rp.oidcRPMetaDataOptionsPublic) {
      return { valid: true };
    }

    // client_secret_basic or client_secret_post
    if (
      authMethod === "client_secret_basic" ||
      authMethod === "client_secret_post"
    ) {
      if (!params.client_secret) {
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "Missing client_secret",
        };
      }
      if (params.client_secret !== rp.oidcRPMetaDataOptionsClientSecret) {
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "Invalid client credentials",
        };
      }
      return { valid: true };
    }

    // client_secret_jwt or private_key_jwt
    if (
      authMethod === "client_secret_jwt" ||
      authMethod === "private_key_jwt"
    ) {
      if (!params.client_assertion) {
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "Missing client_assertion",
        };
      }

      // Validate assertion type
      const expectedAssertionType =
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
      if (params.client_assertion_type !== expectedAssertionType) {
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: `Invalid client_assertion_type, expected ${expectedAssertionType}`,
        };
      }

      try {
        // Verify the JWT assertion
        const result = await this.verifyClientAssertion(
          params.client_assertion,
          clientId,
          authMethod,
          rp,
        );
        return result;
      } catch (err) {
        this.logger.error(`Client assertion verification failed: ${err}`);
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "Invalid client_assertion",
        };
      }
    }

    return {
      valid: false,
      error: "invalid_client",
      errorDescription: "Unknown authentication method",
    };
  }

  /**
   * Verify client assertion JWT (for client_secret_jwt and private_key_jwt)
   * Uses cached JWKS fetch for better performance
   */
  private async verifyClientAssertion(
    assertion: string,
    clientId: string,
    authMethod: "client_secret_jwt" | "private_key_jwt",
    rp: OIDCRPOptions,
  ): Promise<{ valid: boolean; error?: string; errorDescription?: string }> {
    // Decode header to get algorithm
    const [headerB64] = assertion.split(".");
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    const alg = header.alg;

    let key: jose.KeyLike | Uint8Array;

    if (authMethod === "client_secret_jwt") {
      // Verify with HMAC using client secret
      if (!alg.startsWith("HS")) {
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "Invalid algorithm for client_secret_jwt",
        };
      }
      if (!rp.oidcRPMetaDataOptionsClientSecret) {
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "Client secret not configured",
        };
      }
      key = await this.keyManager.createSecretKey(
        rp.oidcRPMetaDataOptionsClientSecret,
      );
    } else {
      // private_key_jwt - verify with RP's public key using cached JWKS
      if (!rp.oidcRPMetaDataOptionsJwks) {
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "Client JWKS not configured",
        };
      }

      const jwks = await this.fetchJWKS(rp.oidcRPMetaDataOptionsJwks);
      if (!jwks) {
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "Failed to fetch client JWKS",
        };
      }

      // Find signing key with optional kid
      const kid = header.kid;
      const sigKey = this.findKeyInJWKS(jwks, "sig", kid);
      if (!sigKey) {
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "No suitable signing key found in client JWKS",
        };
      }

      try {
        key = (await jose.importJWK(sigKey, alg)) as jose.KeyLike;
      } catch (err) {
        this.logger.error(`Failed to import client signing key: ${err}`);
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "Failed to verify client_assertion",
        };
      }
    }

    try {
      const { payload } = await jose.jwtVerify(assertion, key, {
        issuer: clientId,
        audience: this.getIssuer(),
      });

      // Verify sub claim matches client_id
      if (payload.sub !== clientId) {
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "Invalid sub claim in client_assertion",
        };
      }

      // Verify expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return {
          valid: false,
          error: "invalid_client",
          errorDescription: "Client assertion expired",
        };
      }

      return { valid: true };
    } catch (err) {
      this.logger.error(`JWT verification failed: ${err}`);
      return {
        valid: false,
        error: "invalid_client",
        errorDescription: "Invalid client_assertion signature",
      };
    }
  }

  /**
   * Validate logout request parameters
   * Checks post_logout_redirect_uri against allowed URIs for the RP
   */
  validateLogoutRequest(params: {
    post_logout_redirect_uri?: string;
    id_token_hint?: string;
    client_id?: string;
  }): {
    valid: boolean;
    error?: string;
    errorCode?: number;
    rp?: OIDCRPOptions;
    bypassConfirm?: boolean;
  } {
    const { post_logout_redirect_uri, id_token_hint, client_id } = params;

    // If no redirect URI, logout is valid
    if (!post_logout_redirect_uri) {
      return { valid: true };
    }

    // Determine the RP from id_token_hint or client_id
    let rpClientId: string | undefined;
    let rp: OIDCRPOptions | null = null;

    if (id_token_hint) {
      try {
        // Decode id_token to get client_id (aud claim)
        const [, payloadB64] = id_token_hint.split(".");
        const payload = JSON.parse(
          Buffer.from(payloadB64, "base64url").toString(),
        );
        const aud = payload.aud;
        rpClientId = Array.isArray(aud) ? aud[0] : aud;

        // If client_id is also provided, verify it matches
        if (client_id && client_id !== rpClientId) {
          return {
            valid: false,
            error: "Mismatch between id_token_hint and client_id",
            errorCode: 24, // PE_BADCREDENTIALS in LLNG
          };
        }
      } catch {
        // Invalid id_token_hint
        return { valid: false, error: "Invalid id_token_hint", errorCode: 24 };
      }
    } else if (client_id) {
      rpClientId = client_id;
    }

    // Get RP configuration
    if (rpClientId) {
      rp = this.getRP(rpClientId);
    }

    if (!rp) {
      // No RP found - check if redirect URI is unauthorized
      return {
        valid: false,
        error: "post_logout_redirect_uri not allowed",
        errorCode: 108, // PE_OIDC_LOGOUT_URI_NOT_ALLOWED in LLNG
      };
    }

    // Check if post_logout_redirect_uri is allowed for this RP
    const allowedUris = rp.oidcRPMetaDataOptionsPostLogoutRedirectUris || [];
    const uriAllowed = allowedUris.some((allowed) => {
      // Check exact match or pattern match
      if (allowed === post_logout_redirect_uri) {
        return true;
      }
      // Check if it's a prefix match (e.g., http://example.com/* pattern)
      if (allowed.endsWith("*")) {
        return post_logout_redirect_uri.startsWith(allowed.slice(0, -1));
      }
      return false;
    });

    if (!uriAllowed) {
      return {
        valid: false,
        error: "post_logout_redirect_uri not allowed for this client",
        errorCode: 108,
      };
    }

    return {
      valid: true,
      rp,
      bypassConfirm: rp.oidcRPMetaDataOptionsLogoutBypassConfirm,
    };
  }

  /**
   * Get user claims based on scope and RP configuration
   */
  private getUserClaims(
    clientId: string,
    session: Record<string, unknown>,
    scope: string,
  ): Record<string, unknown> {
    const claims: Record<string, unknown> = {};
    const scopes = scope.split(" ");
    const confKey = this.getRPConfKey(clientId);

    // Get exported vars for this RP
    const exportedVars =
      confKey && this.config.oidcRPMetaDataExportedVars?.[confKey];

    if (exportedVars) {
      // Map session attributes to claims based on configuration
      for (const [claimName, sessionAttr] of Object.entries(exportedVars)) {
        if (session[sessionAttr] !== undefined) {
          claims[claimName] = session[sessionAttr];
        }
      }
    }

    // Standard OIDC scope to claims mapping
    const scopeClaims: Record<string, string[]> = {
      profile: [
        "name",
        "family_name",
        "given_name",
        "middle_name",
        "nickname",
        "preferred_username",
        "profile",
        "picture",
        "website",
        "gender",
        "birthdate",
        "zoneinfo",
        "locale",
        "updated_at",
      ],
      email: ["email", "email_verified"],
      address: ["address"],
      phone: ["phone_number", "phone_number_verified"],
    };

    // Only include claims from requested scopes
    for (const s of scopes) {
      if (scopeClaims[s]) {
        for (const claimName of scopeClaims[s]) {
          if (
            claims[claimName] === undefined &&
            session[claimName] !== undefined
          ) {
            claims[claimName] = session[claimName];
          }
        }
      }
    }

    return claims;
  }

  /**
   * Handle userinfo request
   */
  async handleUserInfoRequest(
    accessToken: string,
  ): Promise<Record<string, unknown> | TokenErrorResponse> {
    // Get access token data
    const getFunc =
      this.config.getAccessToken ||
      this.tokenStore.getAccessToken.bind(this.tokenStore);
    const tokenData = await getFunc(accessToken);

    if (!tokenData) {
      return {
        error: "invalid_token",
        error_description: "Invalid access token",
      };
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (tokenData.expiresAt < now) {
      return {
        error: "invalid_token",
        error_description: "Access token expired",
      };
    }

    // Get user session
    let userInfo: Record<string, unknown> = { sub: tokenData.userId };

    if (this.config.getSession && tokenData.sessionId) {
      const session = await this.config.getSession(tokenData.sessionId);
      if (session) {
        const claims = this.getUserClaims(
          tokenData.clientId,
          session,
          tokenData.scope,
        );
        userInfo = { sub: tokenData.userId, ...claims };
      }
    }

    return userInfo;
  }

  /**
   * Handle userinfo request with optional signed/encrypted response
   * Returns JWT string if signing is configured, otherwise JSON object
   */
  async handleUserInfoRequestSigned(
    accessToken: string,
  ): Promise<
    | { response: string | Record<string, unknown>; contentType: string }
    | TokenErrorResponse
  > {
    const result = await this.handleUserInfoRequest(accessToken);

    if ("error" in result) {
      return result;
    }

    // Get access token data to find client
    const getFunc =
      this.config.getAccessToken ||
      this.tokenStore.getAccessToken.bind(this.tokenStore);
    const tokenData = await getFunc(accessToken);

    if (!tokenData) {
      return {
        error: "invalid_token",
        error_description: "Invalid access token",
      };
    }

    // Check if client wants signed userinfo
    const rp = this.getRP(tokenData.clientId);
    const signAlg = rp?.oidcRPMetaDataOptionsUserInfoSignAlg;

    if (!signAlg || signAlg === "none") {
      return { response: result, contentType: "application/json" };
    }

    // Sign the userinfo response as JWT
    const payload: jose.JWTPayload = {
      ...result,
      iss: this.getIssuer(),
      aud: tokenData.clientId,
    };

    try {
      let signedResponse: string;

      if (signAlg.startsWith("HS")) {
        // HMAC signing with client secret
        if (!rp?.oidcRPMetaDataOptionsClientSecret) {
          this.logger.error("Client secret required for HS* signing");
          return { response: result, contentType: "application/json" };
        }
        signedResponse = await this.keyManager.signWithSecret(
          payload,
          rp.oidcRPMetaDataOptionsClientSecret,
          signAlg as "HS256" | "HS384" | "HS512",
        );
      } else {
        // Asymmetric signing
        signedResponse = await this.keyManager.signJWT(payload);
      }

      // Check if encryption is also needed
      const encAlg = rp?.oidcRPMetaDataOptionsUserInfoEncAlg;
      if (encAlg) {
        const rpPublicKey = await this.getRPEncryptionKey(tokenData.clientId);
        if (rpPublicKey) {
          const enc = rp?.oidcRPMetaDataOptionsUserInfoEncEnc || "A256GCM";
          signedResponse = await new jose.CompactEncrypt(
            new TextEncoder().encode(signedResponse),
          )
            .setProtectedHeader({ alg: encAlg, enc, cty: "JWT" })
            .encrypt(rpPublicKey);
        }
      }

      return { response: signedResponse, contentType: "application/jwt" };
    } catch (err) {
      this.logger.error(`Failed to sign userinfo: ${err}`);
      return { response: result, contentType: "application/json" };
    }
  }

  /**
   * Handle introspection request
   */
  async handleIntrospectionRequest(
    token: string,
    _tokenTypeHint?: string,
  ): Promise<IntrospectionResponse> {
    // Try access token first
    const getAccessFunc =
      this.config.getAccessToken ||
      this.tokenStore.getAccessToken.bind(this.tokenStore);
    const accessTokenData = await getAccessFunc(token);

    if (accessTokenData) {
      const now = Math.floor(Date.now() / 1000);
      const active = accessTokenData.expiresAt > now;

      return {
        active,
        scope: accessTokenData.scope,
        client_id: accessTokenData.clientId,
        sub: accessTokenData.userId,
        token_type: "access_token",
        exp: accessTokenData.expiresAt,
        iat: accessTokenData.createdAt,
        iss: this.getIssuer(),
        jti: accessTokenData.jti,
      };
    }

    // Try refresh token
    const getRefreshFunc =
      this.config.getRefreshToken ||
      this.tokenStore.getRefreshToken.bind(this.tokenStore);
    const refreshTokenData = await getRefreshFunc(token);

    if (refreshTokenData) {
      const now = Math.floor(Date.now() / 1000);
      const active = refreshTokenData.expiresAt > now;

      return {
        active,
        scope: refreshTokenData.scope,
        client_id: refreshTokenData.clientId,
        sub: refreshTokenData.userId,
        token_type: "refresh_token",
        exp: refreshTokenData.expiresAt,
        iat: refreshTokenData.createdAt,
        iss: this.getIssuer(),
      };
    }

    return { active: false };
  }

  /**
   * Handle revocation request
   */
  async handleRevocationRequest(
    token: string,
    _tokenTypeHint?: string,
  ): Promise<void> {
    // Try to revoke as access token
    const revokeAccessFunc =
      this.config.revokeAccessToken ||
      this.tokenStore.revokeAccessToken.bind(this.tokenStore);
    await revokeAccessFunc(token);

    // Also try to revoke as refresh token
    const revokeRefreshFunc =
      this.config.revokeRefreshToken ||
      this.tokenStore.revokeRefreshToken.bind(this.tokenStore);
    await revokeRefreshFunc(token);
  }

  /**
   * Get the KeyManager instance
   */
  getKeyManager(): KeyManager {
    return this.keyManager;
  }

  /**
   * Send back-channel logout notification to a specific RP
   * Returns true if successful, false otherwise
   */
  async sendBackChannelLogout(
    clientId: string,
    userId: string,
    sessionId?: string,
  ): Promise<boolean> {
    const rp = this.getRP(clientId);
    if (!rp?.oidcRPMetaDataOptionsBackChannelLogoutURI) {
      return false;
    }

    try {
      // Generate logout token
      const logoutToken = await this.generateLogoutToken(
        clientId,
        userId,
        sessionId,
      );

      // Send POST request to back-channel logout URI
      const response = await fetch(
        rp.oidcRPMetaDataOptionsBackChannelLogoutURI,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            logout_token: logoutToken,
          }).toString(),
        },
      );

      if (response.ok) {
        this.logger.info(
          `Back-channel logout successful for client ${clientId}`,
        );
        return true;
      } else {
        this.logger.warn(
          `Back-channel logout failed for client ${clientId}: ${response.status}`,
        );
        return false;
      }
    } catch (err) {
      this.logger.error(
        `Back-channel logout error for client ${clientId}: ${err}`,
      );
      return false;
    }
  }

  /**
   * Send back-channel logout notifications to all configured RPs
   * Returns array of client IDs that were notified successfully
   */
  async sendBackChannelLogoutToAll(
    userId: string,
    sessionId?: string,
  ): Promise<string[]> {
    const successfulClients: string[] = [];
    const rpOptions = this.config.oidcRPMetaDataOptions || {};

    for (const [, rp] of Object.entries(rpOptions)) {
      if (rp.oidcRPMetaDataOptionsBackChannelLogoutURI) {
        const success = await this.sendBackChannelLogout(
          rp.oidcRPMetaDataOptionsClientID,
          userId,
          sessionId,
        );
        if (success) {
          successfulClients.push(rp.oidcRPMetaDataOptionsClientID);
        }
      }
    }

    return successfulClients;
  }

  /**
   * Generate a logout token for back-channel logout
   * Per OpenID Connect Back-Channel Logout 1.0
   */
  private async generateLogoutToken(
    clientId: string,
    userId: string,
    sessionId?: string,
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const rp = this.getRP(clientId);

    const payload: Record<string, unknown> = {
      iss: this.getIssuer(),
      sub: userId,
      aud: clientId,
      iat: now,
      jti: generateRandomString(16),
      // The events claim is required for logout tokens
      events: {
        "http://schemas.openid.net/event/backchannel-logout": {},
      },
    };

    // Add sid claim if session is provided and RP requires it
    if (
      sessionId &&
      rp?.oidcRPMetaDataOptionsBackChannelLogoutSessionRequired
    ) {
      payload.sid = sessionId;
    }

    // Note: logout tokens MUST NOT contain a nonce claim

    return this.keyManager.signJWT(payload as jose.JWTPayload);
  }

  /**
   * Get front-channel logout URIs for all configured RPs
   * Returns array of URIs with optional session info
   */
  getFrontChannelLogoutURIs(
    userId: string,
    sessionId?: string,
  ): Array<{ uri: string; clientId: string }> {
    const uris: Array<{ uri: string; clientId: string }> = [];
    const rpOptions = this.config.oidcRPMetaDataOptions || {};

    for (const [, rp] of Object.entries(rpOptions)) {
      if (rp.oidcRPMetaDataOptionsFrontChannelLogoutURI) {
        let uri = rp.oidcRPMetaDataOptionsFrontChannelLogoutURI;

        // Add iss and sid if required
        if (
          rp.oidcRPMetaDataOptionsFrontChannelLogoutSessionRequired &&
          sessionId
        ) {
          const url = new URL(uri);
          url.searchParams.set("iss", this.getIssuer());
          url.searchParams.set("sid", sessionId);
          uri = url.toString();
        }

        uris.push({
          uri,
          clientId: rp.oidcRPMetaDataOptionsClientID,
        });
      }
    }

    return uris;
  }

  /**
   * Handle Dynamic Client Registration request
   * Per RFC 7591 and OpenID Connect Dynamic Client Registration 1.0
   */
  async handleRegistration(
    request: ClientRegistrationRequest,
    sourceIp?: string,
  ): Promise<ClientRegistrationResponse | ClientRegistrationErrorResponse> {
    // Check if dynamic registration is allowed
    if (!this.config.oidcServiceAllowDynamicRegistration) {
      this.logger.error("Dynamic registration is not allowed");
      return {
        error: "server_error",
        error_description: "Dynamic registration is not allowed",
      };
    }

    this.logger.notice(
      `OpenID Connect Registration request from ${sourceIp || "unknown"}`,
    );

    // Validate redirect_uris (required)
    if (
      !request.redirect_uris ||
      !Array.isArray(request.redirect_uris) ||
      request.redirect_uris.length === 0
    ) {
      this.logger.error("Field redirect_uris (array) is mandatory");
      return {
        error: "invalid_client_metadata",
        error_description:
          "redirect_uris is required and must be a non-empty array",
      };
    }

    // Validate each redirect_uri for XSS/injection attacks
    for (const uri of request.redirect_uris) {
      if (this.isDangerousUri(uri)) {
        this.logger.error(
          `Registration tried with a forbidden redirect_uri: ${uri}`,
        );
        return {
          error: "invalid_redirect_uri",
          error_description: "Forbidden redirect_uri detected",
        };
      }
    }

    // Generate client credentials
    const registrationTime = Math.floor(Date.now() / 1000);
    const confKey = `register-${registrationTime}`;
    const clientId = generateRandomString(32);
    const clientSecret = generateRandomString(32);

    // Determine default signing algorithm based on key type
    const signingKey = this.keyManager.getSigningKey();
    const defaultSignAlg = signingKey?.kty === "EC" ? "ES256" : "RS256";

    // Build RP options from registration request
    const rpOptions: OIDCRPOptions = {
      oidcRPMetaDataOptionsClientID: clientId,
      oidcRPMetaDataOptionsClientSecret: clientSecret,
      oidcRPMetaDataOptionsDisplayName:
        request.client_name || "Self registered client",
      oidcRPMetaDataOptionsIcon: request.logo_uri,
      oidcRPMetaDataOptionsRedirectUris: request.redirect_uris,
      oidcRPMetaDataOptionsIDTokenSignAlg:
        request.id_token_signed_response_alg || defaultSignAlg,
      oidcRPMetaDataOptionsUserInfoSignAlg:
        request.userinfo_signed_response_alg,
      oidcRPMetaDataOptionsIDTokenEncAlg:
        request.id_token_encrypted_response_alg,
      oidcRPMetaDataOptionsIDTokenEncEnc:
        request.id_token_encrypted_response_enc,
      oidcRPMetaDataOptionsUserInfoEncAlg:
        request.userinfo_encrypted_response_alg,
      oidcRPMetaDataOptionsUserInfoEncEnc:
        request.userinfo_encrypted_response_enc,
      oidcRPMetaDataOptionsPostLogoutRedirectUris:
        request.post_logout_redirect_uris,
      oidcRPMetaDataOptionsTokenEndpointAuthMethod:
        request.token_endpoint_auth_method || "client_secret_basic",
    };

    // Handle JWKS
    if (request.jwks_uri) {
      rpOptions.oidcRPMetaDataOptionsJwks = request.jwks_uri;
    } else if (request.jwks) {
      rpOptions.oidcRPMetaDataOptionsJwks = JSON.stringify(request.jwks);
    }

    // Handle logout configuration
    if (request.frontchannel_logout_uri) {
      rpOptions.oidcRPMetaDataOptionsFrontChannelLogoutURI =
        request.frontchannel_logout_uri;
      rpOptions.oidcRPMetaDataOptionsFrontChannelLogoutSessionRequired =
        request.frontchannel_logout_session_required || false;
    }
    if (request.backchannel_logout_uri) {
      rpOptions.oidcRPMetaDataOptionsBackChannelLogoutURI =
        request.backchannel_logout_uri;
      rpOptions.oidcRPMetaDataOptionsBackChannelLogoutSessionRequired =
        request.backchannel_logout_session_required || false;
    }

    // Get exported vars from dynamic registration config
    let exportedVars: OIDCRPExportedVars | undefined;
    if (this.config.oidcServiceDynamicRegistrationExportedVars) {
      exportedVars = {
        ...this.config.oidcServiceDynamicRegistrationExportedVars,
      };
    }

    // Get extra claims from dynamic registration config
    if (this.config.oidcServiceDynamicRegistrationExtraClaims) {
      rpOptions.oidcRPMetaDataOptionsExtraClaims = {
        ...this.config.oidcServiceDynamicRegistrationExtraClaims,
      };
    }

    // Register the RP using callback or in-memory
    if (this.config.registerRP) {
      const success = await this.config.registerRP(
        confKey,
        rpOptions,
        exportedVars,
      );
      if (!success) {
        this.logger.error("Failed to save RP configuration");
        return {
          error: "server_error",
          error_description: "Failed to save client registration",
        };
      }
    } else {
      // In-memory registration (for testing)
      if (!this.config.oidcRPMetaDataOptions) {
        this.config.oidcRPMetaDataOptions = {};
      }
      this.config.oidcRPMetaDataOptions[confKey] = rpOptions;

      if (exportedVars) {
        if (!this.config.oidcRPMetaDataExportedVars) {
          this.config.oidcRPMetaDataExportedVars = {};
        }
        this.config.oidcRPMetaDataExportedVars[confKey] = exportedVars;
      }
    }

    this.logger.info(`Client registered successfully: ${clientId}`);

    // Build registration response
    const response: ClientRegistrationResponse = {
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: registrationTime,
      client_secret_expires_at: 0, // Never expires
      client_name: rpOptions.oidcRPMetaDataOptionsDisplayName,
      logo_uri: request.logo_uri,
      redirect_uris: request.redirect_uris,
      id_token_signed_response_alg:
        rpOptions.oidcRPMetaDataOptionsIDTokenSignAlg,
      token_endpoint_auth_method:
        rpOptions.oidcRPMetaDataOptionsTokenEndpointAuthMethod,
    };

    // Include optional fields if present
    if (request.userinfo_signed_response_alg) {
      response.userinfo_signed_response_alg =
        request.userinfo_signed_response_alg;
    }
    if (request.request_uris && request.request_uris.length > 0) {
      response.request_uris = request.request_uris;
    }
    if (request.grant_types) {
      response.grant_types = request.grant_types;
    }
    if (request.response_types) {
      response.response_types = request.response_types;
    }

    return response;
  }

  /**
   * Check if a URI is potentially dangerous (XSS, injection)
   */
  private isDangerousUri(uri: string): boolean {
    // Check for dangerous schemes
    const dangerousSchemes = /^\s*(javascript|vbscript|data):/i;
    if (dangerousSchemes.test(uri)) {
      return true;
    }

    // Check for common XSS patterns
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // onclick=, onerror=, etc.
      /%3Cscript/i, // URL encoded <script
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(uri)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if dynamic registration is enabled
   */
  isDynamicRegistrationEnabled(): boolean {
    return this.config.oidcServiceAllowDynamicRegistration === true;
  }
}

export default OIDCProvider;
