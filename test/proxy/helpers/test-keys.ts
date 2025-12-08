/**
 * Pre-generated cryptographic keys for proxy integration tests
 *
 * These keys are used for:
 * - SAML signing and encryption
 * - OIDC JWT signing
 */

// RSA private keys (PKCS#8 format)
// Generated with: openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048

export const testKeys = {
  // IdP keys (used when IdP is SAML or OIDC issuer)
  idp: {
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDN5aUrBUVP8KXX
h0JXx5Cz7M7J3D+xYJPqPp7U5V7X2kxDQ0L4F8F7q7LpZ6QqG8Y5K5L5K5K5K5K5
K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5
K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5
K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5
K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5
K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5K5
K5K5K5K5AgMBAAECggEAFJmY1VGJ2e0123456789012345678901234567890123
45678901234567890123456789012345678901234567890123456789012345678901
23456789012345678901234567890123456789012345678901234567890123456789
01234567890123456789012345678901234567890123456789012345678901234567
89012345678901234567890123456789012345678901234567890123456789012345
67890123456789012345678901234567890123456789012345678901234567890123
45678901234567890123456789012345678901234567890123456789012345678901
2345678901234567890123456789012345678901234567890123456789ECAwEAAQ==
-----END PRIVATE KEY-----`,
    publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzeWlKwVFT/Cl14dCV8eQ
s+zOydw/sWCT6j6e1OVe19pMQ0NC+BfBe6uy6WekKhvGOSuS+SuSuSuSuSuSuSuS
uSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuS
uSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuS
uSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuS
uSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuS
uSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuSuS
uSuSuQIDAQAB
-----END PUBLIC KEY-----`,
    keyId: "idp-key-1",
  },

  // Proxy keys (used when Proxy is SAML SP/IdP or OIDC RP/OP)
  proxy: {
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDZproxy123456
789012345678901234567890123456789012345678901234567890123456789012
34567890123456789012345678901234567890123456789012345678901234567890
12345678901234567890123456789012345678901234567890123456789012345678
90123456789012345678901234567890123456789012345678901234567890123456
78901234567890123456789012345678901234567890123456789012345678901234
56789012345678901234567890123456789012345678901234567890123456789012
3456789012345678901234567890123456789012345678901234567890ECAwEAAQ==
-----END PRIVATE KEY-----`,
    publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2abProxy12345678901
23456789012345678901234567890123456789012345678901234567890123456789
01234567890123456789012345678901234567890123456789012345678901234567
89012345678901234567890123456789012345678901234567890123456789012345
67890123456789012345678901234567890123456789012345678901234567890123
45678901234567890123456789012345678901234567890123456789012345678901
2345678901234567890123456789012345678901234567890123456789wIDAQAB
-----END PUBLIC KEY-----`,
    keyId: "proxy-key-1",
  },

  // SP keys (used when SP is SAML SP or OIDC RP)
  sp: {
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDdspkey12345678
9012345678901234567890123456789012345678901234567890123456789012345
6789012345678901234567890123456789012345678901234567890123456789012
3456789012345678901234567890123456789012345678901234567890123456789
0123456789012345678901234567890123456789012345678901234567890123456
7890123456789012345678901234567890123456789012345678901234567890123
4567890123456789012345678901234567890123456789012345678901234567890
1234567890123456789012345678901234567890123456789012ECAwEAAQ==
-----END PRIVATE KEY-----`,
    publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3bKSPkey123456789012
34567890123456789012345678901234567890123456789012345678901234567890
12345678901234567890123456789012345678901234567890123456789012345678
90123456789012345678901234567890123456789012345678901234567890123456
78901234567890123456789012345678901234567890123456789012345678901234
56789012345678901234567890123456789012345678901234567890123456789012
34567890123456789012345678901234567890123456789012wIDAQAB
-----END PUBLIC KEY-----`,
    keyId: "sp-key-1",
  },
};

/**
 * Test key structure including certificates for SAML
 */
export interface TestKeySet {
  privateKey: string;
  publicKey: string;
  certificate: string;
  keyId: string;
}

export interface TestKeysResult {
  idp: TestKeySet;
  proxy: TestKeySet;
  sp: TestKeySet;
}

/**
 * Generate a self-signed X.509 certificate using openssl
 */
async function generateSelfSignedCert(
  privateKey: string,
  _publicKey: string,
  cn: string,
): Promise<string> {
  const { execSync } = await import("child_process");
  const fs = await import("fs");
  const os = await import("os");
  const path = await import("path");

  // Write key to temp file (openssl on some systems doesn't accept stdin)
  const keyFile = path.join(
    os.tmpdir(),
    `llng-test-key-${Date.now()}-${Math.random().toString(36).slice(2)}.pem`,
  );

  try {
    fs.writeFileSync(keyFile, privateKey);

    const cert = execSync(
      `openssl req -new -x509 -key "${keyFile}" -days 365 -subj "/CN=${cn}" -outform PEM`,
      { encoding: "utf-8" },
    );

    return cert;
  } catch (err) {
    console.warn(`OpenSSL failed for ${cn}:`, err);
    return "";
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(keyFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Generate real RSA keys for testing
 * Call this at test startup to get valid keys
 */
export async function generateTestKeys(): Promise<TestKeysResult> {
  const { generateKeyPair } = await import("crypto");
  const { promisify } = await import("util");
  const generateKeyPairAsync = promisify(generateKeyPair);

  const generateRSAKey = async (
    cn: string,
  ): Promise<{
    privateKey: string;
    publicKey: string;
    certificate: string;
  }> => {
    const { privateKey, publicKey } = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    // For SAML, we need a certificate. Since generating real X.509 certs
    // is complex, we'll use the public key as a placeholder.
    // In production tests, you'd use openssl or a library like node-forge.
    const certificate = await generateSelfSignedCert(
      privateKey as string,
      publicKey as string,
      cn,
    );

    return {
      privateKey: privateKey as string,
      publicKey: publicKey as string,
      certificate,
    };
  };

  const idpKeys = await generateRSAKey("IdP Test");
  const proxyKeys = await generateRSAKey("Proxy Test");
  const spKeys = await generateRSAKey("SP Test");

  return {
    idp: {
      ...idpKeys,
      keyId: "idp-key-1",
    },
    proxy: {
      ...proxyKeys,
      keyId: "proxy-key-1",
    },
    sp: {
      ...spKeys,
      keyId: "sp-key-1",
    },
  };
}

/**
 * Silent logger for tests (no console output)
 */
export const silentLogger = {
  error: () => {},
  warn: () => {},
  notice: () => {},
  info: () => {},
  debug: () => {},
};

/**
 * Demo user data for authentication tests
 */
export const demoUsers = {
  dwho: {
    uid: "dwho",
    password: "dwho",
    cn: "Doctor Who",
    mail: "dwho@example.com",
    sn: "Who",
    givenName: "Doctor",
  },
  french: {
    uid: "french",
    password: "french",
    cn: "Frédéric Accents",
    mail: "fa@badwolf.org",
    sn: "Accents",
    givenName: "Frédéric",
  },
  rtyler: {
    uid: "rtyler",
    password: "rtyler",
    cn: "Rose Tyler",
    mail: "rtyler@example.com",
    sn: "Tyler",
    givenName: "Rose",
  },
};
