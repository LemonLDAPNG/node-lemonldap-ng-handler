/**
 * OIDC Authentication Module (Relying Party)
 *
 * Handles OpenID Connect authentication flow.
 */

import { randomBytes, createHash } from "crypto";
import {
  OIDCAuthConfig,
  OIDCOPConfig,
  OIDCOPOptions,
  OIDCStateData,
  OIDCAuthResult,
  OPListItem,
  Logger,
} from "./types";

/**
 * Default logger (console)
 */
const defaultLogger: Logger = {
  error: (...args) => console.error("[OIDC-Auth]", ...args),
  warn: (...args) => console.warn("[OIDC-Auth]", ...args),
  notice: (...args) => console.log("[OIDC-Auth]", ...args),
  info: (...args) => console.info("[OIDC-Auth]", ...args),
  debug: (...args) => console.debug("[OIDC-Auth]", ...args),
};

/**
 * In-memory state store (for development/testing)
 */
class InMemoryStateStore {
  private states = new Map<string, OIDCStateData>();

  async storeState(state: string, data: OIDCStateData): Promise<void> {
    this.states.set(state, data);
  }

  async consumeState(state: string): Promise<OIDCStateData | null> {
    const data = this.states.get(state);
    if (data) {
      this.states.delete(state);
      return data;
    }
    return null;
  }
}

/**
 * OIDC Authentication class
 */
export class OIDCAuth {
  private config: OIDCAuthConfig;
  private logger: Logger;
  private stateStore: InMemoryStateStore;
  private opConfigs = new Map<string, OIDCOPConfig>();
  private initialized = false;

  constructor(config: OIDCAuthConfig) {
    this.config = config;
    this.logger = config.logger || defaultLogger;
    this.stateStore = new InMemoryStateStore();
  }

  /**
   * Initialize the auth module (discover all OPs)
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    const ops = this.config.oidcOPMetaData || {};

    for (const [confKey, opConfig] of Object.entries(ops)) {
      try {
        await this.initOP(confKey, opConfig);
      } catch (err) {
        this.logger.error(`Failed to initialize OP ${confKey}: ${err}`);
      }
    }

    this.initialized = true;
    this.logger.info("OIDC Auth module initialized");
  }

  /**
   * Initialize a single OP
   */
  private async initOP(confKey: string, opConfig: OIDCOPConfig): Promise<void> {
    const options = opConfig.oidcOPMetaDataOptions;

    // Discover OP configuration if URI is provided
    if (
      options.oidcOPMetaDataOptionsConfigurationURI &&
      !opConfig.oidcOPMetaDataJSON
    ) {
      try {
        const response = await fetch(
          options.oidcOPMetaDataOptionsConfigurationURI,
        );
        if (response.ok) {
          const metadata = (await response.json()) as Record<string, string>;
          opConfig.oidcOPMetaDataJSON = JSON.stringify(metadata);

          // Extract endpoints from discovery document
          if (!options.oidcOPMetaDataOptionsAuthorizeURI) {
            options.oidcOPMetaDataOptionsAuthorizeURI =
              metadata.authorization_endpoint;
          }
          if (!options.oidcOPMetaDataOptionsTokenURI) {
            options.oidcOPMetaDataOptionsTokenURI = metadata.token_endpoint;
          }
          if (!options.oidcOPMetaDataOptionsUserInfoURI) {
            options.oidcOPMetaDataOptionsUserInfoURI =
              metadata.userinfo_endpoint;
          }
          if (!options.oidcOPMetaDataOptionsJWKSURI) {
            options.oidcOPMetaDataOptionsJWKSURI = metadata.jwks_uri;
          }
          if (!options.oidcOPMetaDataOptionsEndSessionURI) {
            options.oidcOPMetaDataOptionsEndSessionURI =
              metadata.end_session_endpoint;
          }
        }
      } catch (err) {
        this.logger.warn(
          `Failed to fetch discovery document for ${confKey}: ${err}`,
        );
      }
    }

    // Store the configuration for this OP
    this.opConfigs.set(confKey, opConfig);
    this.logger.info(
      `OP ${confKey} initialized (client_id: ${options.oidcOPMetaDataOptionsClientID})`,
    );
  }

  /**
   * Get list of configured OPs for UI selection
   */
  getOPList(): OPListItem[] {
    const ops = this.config.oidcOPMetaData || {};
    const list: OPListItem[] = [];

    for (const [confKey, opConfig] of Object.entries(ops)) {
      const options = opConfig.oidcOPMetaDataOptions;
      list.push({
        val: confKey,
        name: options.oidcOPMetaDataOptionsDisplayName || confKey,
        title:
          options.oidcOPMetaDataOptionsTooltip ||
          options.oidcOPMetaDataOptionsDisplayName ||
          confKey,
        icon: options.oidcOPMetaDataOptionsIcon,
        order: options.oidcOPMetaDataOptionsSortNumber ?? 999999,
      });
    }

    // Sort by order, then name, then confKey
    return list.sort(
      (a, b) =>
        a.order - b.order ||
        a.name.localeCompare(b.name) ||
        a.val.localeCompare(b.val),
    );
  }

  /**
   * Get authorization URL for an OP
   */
  async getAuthorizationUrl(
    opConfKey: string,
    redirectUri: string,
    urldc?: string,
  ): Promise<string> {
    const opConfig = this.config.oidcOPMetaData?.[opConfKey];
    if (!opConfig) {
      throw new Error(`Unknown OP: ${opConfKey}`);
    }

    const options = opConfig.oidcOPMetaDataOptions;

    // Generate state
    const state = this.generateRandomString(32);
    const nonce =
      options.oidcOPMetaDataOptionsUseNonce !== false
        ? this.generateRandomString(32)
        : undefined;

    // Generate PKCE if enabled
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;
    let codeChallengeMethod: "S256" | "plain" | undefined;

    if (options.oidcOPMetaDataOptionsUsePKCE) {
      codeVerifier = this.generateRandomString(32);
      codeChallengeMethod = options.oidcOPMetaDataOptionsPKCEMethod || "S256";

      if (codeChallengeMethod === "S256") {
        const hash = createHash("sha256").update(codeVerifier).digest();
        codeChallenge = hash.toString("base64url");
      } else {
        codeChallenge = codeVerifier;
      }
    }

    // Store state
    const stateData: OIDCStateData = {
      op: opConfKey,
      nonce,
      codeVerifier,
      urldc,
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt:
        Math.floor(Date.now() / 1000) + (this.config.oidcRPStateTimeout || 600),
    };

    const storeFunc =
      this.config.storeState ||
      this.stateStore.storeState.bind(this.stateStore);
    await storeFunc(state, stateData);

    // Build authorization URL
    const authUrl = new URL(options.oidcOPMetaDataOptionsAuthorizeURI || "");

    const params = new URLSearchParams();
    params.set(
      "response_type",
      options.oidcOPMetaDataOptionsResponseType || "code",
    );
    params.set("client_id", options.oidcOPMetaDataOptionsClientID);
    params.set("redirect_uri", redirectUri);
    params.set(
      "scope",
      options.oidcOPMetaDataOptionsScope || "openid profile email",
    );
    params.set("state", state);

    if (nonce) {
      params.set("nonce", nonce);
    }

    if (codeChallenge) {
      params.set("code_challenge", codeChallenge);
      params.set("code_challenge_method", codeChallengeMethod!);
    }

    if (options.oidcOPMetaDataOptionsPrompt) {
      params.set("prompt", options.oidcOPMetaDataOptionsPrompt);
    }

    if (options.oidcOPMetaDataOptionsAcrValues) {
      params.set("acr_values", options.oidcOPMetaDataOptionsAcrValues);
    }

    authUrl.search = params.toString();
    return authUrl.toString();
  }

  /**
   * Handle callback from OP
   */
  async handleCallback(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<OIDCAuthResult> {
    // Retrieve and validate state
    const consumeFunc =
      this.config.consumeState ||
      this.stateStore.consumeState.bind(this.stateStore);
    const stateData = await consumeFunc(state);

    if (!stateData) {
      return {
        success: false,
        error: "invalid_state",
        errorDescription: "State not found or expired",
      };
    }

    // Check state expiration
    const now = Math.floor(Date.now() / 1000);
    if (stateData.expiresAt < now) {
      return {
        success: false,
        error: "invalid_state",
        errorDescription: "State expired",
      };
    }

    // Get OP configuration
    const opConfig = this.config.oidcOPMetaData?.[stateData.op];
    if (!opConfig) {
      return {
        success: false,
        error: "invalid_request",
        errorDescription: `Unknown OP: ${stateData.op}`,
      };
    }

    const options = opConfig.oidcOPMetaDataOptions;

    try {
      // Exchange code for tokens
      const tokenParams: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: options.oidcOPMetaDataOptionsClientID,
      };

      if (options.oidcOPMetaDataOptionsClientSecret) {
        tokenParams.client_secret = options.oidcOPMetaDataOptionsClientSecret;
      }

      if (stateData.codeVerifier) {
        tokenParams.code_verifier = stateData.codeVerifier;
      }

      // Make token request
      const tokenResponse = await this.makeTokenRequest(options, tokenParams);

      if (!tokenResponse.id_token) {
        return {
          success: false,
          error: "invalid_response",
          errorDescription: "No ID token in response",
        };
      }

      // Decode ID token (basic decode, not full validation)
      const idTokenPayload = this.decodeJWT(tokenResponse.id_token);

      // Validate nonce
      if (stateData.nonce && idTokenPayload.nonce !== stateData.nonce) {
        return {
          success: false,
          error: "invalid_token",
          errorDescription: "Nonce mismatch",
        };
      }

      // Get user ID (subject)
      const userId = idTokenPayload.sub as string;

      // Get user info if configured
      let userInfo: Record<string, unknown> = { sub: userId };

      if (
        options.oidcOPMetaDataOptionsGetUserInfo !== false &&
        tokenResponse.access_token
      ) {
        try {
          userInfo = await this.getUserInfo(
            options,
            tokenResponse.access_token,
          );
        } catch (err) {
          this.logger.warn(`Failed to get user info: ${err}`);
        }
      }

      // Build session data from exported vars
      const sessionData = this.buildSessionData(
        opConfig,
        idTokenPayload,
        userInfo,
      );

      return {
        success: true,
        userId,
        userInfo,
        idToken: options.oidcOPMetaDataOptionsStoreIDToken
          ? tokenResponse.id_token
          : undefined,
        accessToken: options.oidcOPMetaDataOptionsStoreAccessToken
          ? tokenResponse.access_token
          : undefined,
        refreshToken: tokenResponse.refresh_token,
        sessionData,
      };
    } catch (err) {
      this.logger.error(`Token exchange failed: ${err}`);
      return {
        success: false,
        error: "token_error",
        errorDescription: `Token exchange failed: ${err}`,
      };
    }
  }

  /**
   * Handle error callback from OP
   */
  handleErrorCallback(
    error: string,
    errorDescription?: string,
  ): OIDCAuthResult {
    return {
      success: false,
      error,
      errorDescription,
    };
  }

  /**
   * Get logout URL for an OP
   */
  getLogoutUrl(
    opConfKey: string,
    idTokenHint?: string,
    postLogoutRedirectUri?: string,
  ): string | null {
    const opConfig = this.config.oidcOPMetaData?.[opConfKey];
    if (!opConfig) {
      return null;
    }

    const options = opConfig.oidcOPMetaDataOptions;
    const endSessionUri = options.oidcOPMetaDataOptionsEndSessionURI;

    if (!endSessionUri) {
      return null;
    }

    const url = new URL(endSessionUri);
    const params = new URLSearchParams();

    if (idTokenHint) {
      params.set("id_token_hint", idTokenHint);
    }

    if (postLogoutRedirectUri) {
      params.set("post_logout_redirect_uri", postLogoutRedirectUri);
    }

    if (params.toString()) {
      url.search = params.toString();
    }

    return url.toString();
  }

  /**
   * Make token request to OP
   */
  private async makeTokenRequest(
    options: OIDCOPOptions,
    params: Record<string, string>,
  ): Promise<{
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
  }> {
    const tokenUri = options.oidcOPMetaDataOptionsTokenURI;
    if (!tokenUri) {
      throw new Error("Token endpoint not configured");
    }

    const authMethod =
      options.oidcOPMetaDataOptionsTokenEndpointAuthMethod ||
      "client_secret_basic";

    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    // Handle authentication
    if (
      authMethod === "client_secret_basic" &&
      options.oidcOPMetaDataOptionsClientSecret
    ) {
      const credentials = Buffer.from(
        `${encodeURIComponent(options.oidcOPMetaDataOptionsClientID)}:${encodeURIComponent(options.oidcOPMetaDataOptionsClientSecret)}`,
      ).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
      // Remove from body
      delete params.client_secret;
    }

    const response = await fetch(tokenUri, {
      method: "POST",
      headers,
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token request failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Get user info from OP
   */
  private async getUserInfo(
    options: OIDCOPOptions,
    accessToken: string,
  ): Promise<Record<string, unknown>> {
    const userInfoUri = options.oidcOPMetaDataOptionsUserInfoURI;
    if (!userInfoUri) {
      throw new Error("UserInfo endpoint not configured");
    }

    const response = await fetch(userInfoUri, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`UserInfo request failed: ${response.status}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  /**
   * Build session data from claims
   */
  private buildSessionData(
    opConfig: OIDCOPConfig,
    idTokenClaims: Record<string, unknown>,
    userInfo: Record<string, unknown>,
  ): Record<string, unknown> {
    const sessionData: Record<string, unknown> = {};
    const exportedVars = opConfig.oidcOPMetaDataExportedVars || {};

    // Merge claims (userInfo takes precedence)
    const allClaims = { ...idTokenClaims, ...userInfo };

    // Map claims to session attributes
    for (const [sessionAttr, claimName] of Object.entries(exportedVars)) {
      if (allClaims[claimName] !== undefined) {
        sessionData[sessionAttr] = allClaims[claimName];
      }
    }

    // Always include sub
    sessionData._oidc_sub = allClaims.sub;
    sessionData._oidc_op = opConfig.confKey;

    return sessionData;
  }

  /**
   * Decode JWT payload (without validation)
   */
  private decodeJWT(token: string): Record<string, unknown> {
    const [, payload] = token.split(".");
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(decoded);
  }

  /**
   * Generate random string
   */
  private generateRandomString(length: number): string {
    return randomBytes(length).toString("base64url");
  }
}

export default OIDCAuth;
