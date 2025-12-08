/**
 * SAML Server Manager
 *
 * Manages Lasso Server instances for IdP and SP operations.
 * Handles initialization, provider registration, and server lifecycle.
 */

import {
  init as lassoInit,
  shutdown as lassoShutdown,
  isInitialized as lassoIsInitialized,
  Server,
  type ProviderInfo,
} from "lasso.js";

import type { Logger, SAMLServiceConfig } from "./types";

/**
 * Configuration for ServerManager
 */
export interface ServerManagerConfig extends SAMLServiceConfig {
  /** Base URL of the portal */
  portal: string;
  /** IdP metadata XML by config key */
  samlIdPMetaDataXML?: Record<string, string>;
  /** SP metadata XML by config key */
  samlSPMetaDataXML?: Record<string, string>;
}

/**
 * Manages Lasso Server instances for SAML operations
 */
export class ServerManager {
  private config: ServerManagerConfig;
  private logger: Logger;
  private server: Server | null = null;
  private initialized = false;
  private metadataCache: string | null = null;

  constructor(config: ServerManagerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize the Lasso library and create the Server
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Initialize Lasso library if not already done
    if (!lassoIsInitialized()) {
      this.logger.info("SAML ServerManager: Initializing Lasso library");
      lassoInit();
    }

    // Check required configuration
    if (!this.config.samlEntityID) {
      throw new Error("SAML ServerManager: samlEntityID is required");
    }

    if (
      !this.config.samlServiceMetaDataPrivateKeySig ||
      !this.config.samlServiceMetaDataPublicKeySig
    ) {
      throw new Error(
        "SAML ServerManager: Signing key and certificate are required",
      );
    }

    try {
      // Generate our own metadata
      const metadata = this.generateMetadata();
      this.metadataCache = metadata;

      // Create Server from our metadata and keys
      this.server = Server.fromBuffers(
        metadata,
        this.config.samlServiceMetaDataPrivateKeySig,
        this.config.samlServiceMetaDataPublicKeySig,
        this.config.samlServiceMetaDataPrivateKeySigPwd,
      );

      this.logger.info(
        `SAML ServerManager: Server created for entity ${this.config.samlEntityID}`,
      );

      // Register remote IdPs
      if (this.config.samlIdPMetaDataXML) {
        for (const [confKey, metadata] of Object.entries(
          this.config.samlIdPMetaDataXML,
        )) {
          this.addIdP(confKey, metadata);
        }
      }

      // Register remote SPs
      if (this.config.samlSPMetaDataXML) {
        for (const [confKey, metadata] of Object.entries(
          this.config.samlSPMetaDataXML,
        )) {
          this.addSP(confKey, metadata);
        }
      }

      this.initialized = true;
      this.logger.info("SAML ServerManager: Initialization complete");
    } catch (err) {
      this.logger.error(`SAML ServerManager: Initialization failed: ${err}`);
      throw err;
    }
  }

  /**
   * Add a remote IdP from metadata
   * @param confKey - Configuration key for this IdP
   * @param metadata - IdP metadata XML
   */
  addIdP(confKey: string, metadata: string): void {
    if (!this.server) {
      throw new Error("SAML ServerManager: Server not initialized");
    }

    try {
      // Extract entity ID from metadata
      const entityId = this.extractEntityId(metadata);
      if (!entityId) {
        throw new Error("Could not extract entityID from metadata");
      }

      this.server.addProviderFromBuffer(entityId, metadata);
      this.logger.info(
        `SAML ServerManager: Added IdP '${confKey}' (${entityId})`,
      );
    } catch (err) {
      this.logger.error(
        `SAML ServerManager: Failed to add IdP '${confKey}': ${err}`,
      );
      throw err;
    }
  }

  /**
   * Add a remote SP from metadata
   * @param confKey - Configuration key for this SP
   * @param metadata - SP metadata XML
   */
  addSP(confKey: string, metadata: string): void {
    if (!this.server) {
      throw new Error("SAML ServerManager: Server not initialized");
    }

    try {
      // Extract entity ID from metadata
      const entityId = this.extractEntityId(metadata);
      if (!entityId) {
        throw new Error("Could not extract entityID from metadata");
      }

      this.server.addProviderFromBuffer(entityId, metadata);
      this.logger.info(
        `SAML ServerManager: Added SP '${confKey}' (${entityId})`,
      );
    } catch (err) {
      this.logger.error(
        `SAML ServerManager: Failed to add SP '${confKey}': ${err}`,
      );
      throw err;
    }
  }

  /**
   * Get the Lasso Server instance
   */
  getServer(): Server {
    if (!this.server) {
      throw new Error("SAML ServerManager: Server not initialized");
    }
    return this.server;
  }

  /**
   * Get provider info by entity ID
   */
  getProvider(entityId: string): ProviderInfo | null {
    if (!this.server) return null;
    return this.server.getProvider(entityId);
  }

  /**
   * Get our own metadata
   */
  getMetadata(): string {
    if (!this.metadataCache) {
      this.metadataCache = this.generateMetadata();
    }
    return this.metadataCache;
  }

  /**
   * Get our entity ID
   */
  getEntityId(): string {
    return this.config.samlEntityID;
  }

  /**
   * Shutdown this ServerManager instance
   * Note: Does NOT call lassoShutdown() to allow reuse of the lasso library
   * by other ServerManager instances in the same process (e.g., tests)
   */
  shutdown(): void {
    // Just clear our server reference - don't shut down the global lasso library
    // This allows other ServerManager instances to continue using lasso
    this.server = null;
    this.initialized = false;
    this.logger.info("SAML ServerManager: Instance shutdown");
  }

  /**
   * Extract entity ID from metadata XML
   */
  private extractEntityId(metadata: string): string | null {
    const match = metadata.match(/entityID=["']([^"']+)["']/);
    return match ? match[1] : null;
  }

  /**
   * Generate SAML metadata for this service
   */
  private generateMetadata(): string {
    const entityId = this.config.samlEntityID;
    const portal = this.config.portal.replace(/\/$/, "");
    const cert = this.extractCertContent(
      this.config.samlServiceMetaDataPublicKeySig || "",
    );

    // Get validity dates
    const now = new Date();
    const validUntil = new Date(
      now.getTime() +
        (this.config.samlMetadataValidityDays || 365) * 24 * 60 * 60 * 1000,
    );
    const validUntilStr = validUntil.toISOString();

    // Build SSO descriptors based on config
    const ssoBindings = this.buildSSOBindings(portal);
    const sloBindings = this.buildSLOBindings(portal);

    return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
                  entityID="${escapeXml(entityId)}"
                  validUntil="${validUntilStr}">
  <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
                    WantAuthnRequestsSigned="${this.config.samlSPSSODescriptorAuthnRequestsSigned ? "true" : "false"}">
    <KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${cert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>
${this.config.samlServiceMetaDataPublicKeyEnc ? this.buildEncryptionKeyDescriptor() : ""}
${ssoBindings}
${sloBindings}
    <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</NameIDFormat>
    <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</NameIDFormat>
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified</NameIDFormat>
  </IDPSSODescriptor>
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol"
                   AuthnRequestsSigned="${this.config.samlSPSSODescriptorAuthnRequestsSigned ? "true" : "false"}"
                   WantAssertionsSigned="${this.config.samlSPSSODescriptorWantAssertionsSigned ? "true" : "false"}">
    <KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${cert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>
${this.config.samlServiceMetaDataPublicKeyEnc ? this.buildEncryptionKeyDescriptor() : ""}
${sloBindings}
    <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</NameIDFormat>
    <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</NameIDFormat>
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                              Location="${escapeXml(portal)}/saml/acs"
                              index="1"
                              isDefault="true"/>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Artifact"
                              Location="${escapeXml(portal)}/saml/acs"
                              index="2"/>
  </SPSSODescriptor>
${this.buildOrganization()}
</EntityDescriptor>`;
  }

  /**
   * Build SSO binding elements
   */
  private buildSSOBindings(portal: string): string {
    const bindings: string[] = [];

    if (
      this.config.samlSPSSODescriptorSingleSignOnServiceHTTPRedirect !== false
    ) {
      bindings.push(
        `    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                           Location="${escapeXml(portal)}/saml/singleSignOn"/>`,
      );
    }

    if (this.config.samlSPSSODescriptorSingleSignOnServiceHTTPPost !== false) {
      bindings.push(
        `    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                           Location="${escapeXml(portal)}/saml/singleSignOn"/>`,
      );
    }

    if (this.config.samlSPSSODescriptorSingleSignOnServiceHTTPArtifact) {
      bindings.push(
        `    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Artifact"
                           Location="${escapeXml(portal)}/saml/singleSignOn"/>`,
      );
    }

    return bindings.join("\n");
  }

  /**
   * Build SLO binding elements
   */
  private buildSLOBindings(portal: string): string {
    const bindings: string[] = [];

    if (
      this.config.samlSPSSODescriptorSingleLogoutServiceHTTPRedirect !== false
    ) {
      bindings.push(
        `    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                          Location="${escapeXml(portal)}/saml/singleLogout"/>`,
      );
    }

    if (this.config.samlSPSSODescriptorSingleLogoutServiceHTTPPost !== false) {
      bindings.push(
        `    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                          Location="${escapeXml(portal)}/saml/singleLogout"/>`,
      );
    }

    if (this.config.samlSPSSODescriptorSingleLogoutServiceSOAP) {
      bindings.push(
        `    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:SOAP"
                          Location="${escapeXml(portal)}/saml/singleLogoutSOAP"/>`,
      );
    }

    return bindings.join("\n");
  }

  /**
   * Build encryption key descriptor
   */
  private buildEncryptionKeyDescriptor(): string {
    const cert = this.extractCertContent(
      this.config.samlServiceMetaDataPublicKeyEnc || "",
    );
    return `    <KeyDescriptor use="encryption">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${cert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>`;
  }

  /**
   * Build organization element
   */
  private buildOrganization(): string {
    if (
      !this.config.samlOrganizationName &&
      !this.config.samlOrganizationDisplayName
    ) {
      return "";
    }

    const name = this.config.samlOrganizationName || "Organization";
    const displayName = this.config.samlOrganizationDisplayName || name;
    const url = this.config.samlOrganizationURL || this.config.portal;

    return `  <Organization>
    <OrganizationName xml:lang="en">${escapeXml(name)}</OrganizationName>
    <OrganizationDisplayName xml:lang="en">${escapeXml(displayName)}</OrganizationDisplayName>
    <OrganizationURL xml:lang="en">${escapeXml(url)}</OrganizationURL>
  </Organization>`;
  }

  /**
   * Extract certificate content from PEM
   */
  private extractCertContent(pem: string): string {
    return pem
      .replace(/-----BEGIN CERTIFICATE-----/g, "")
      .replace(/-----END CERTIFICATE-----/g, "")
      .replace(/\s/g, "");
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default ServerManager;
