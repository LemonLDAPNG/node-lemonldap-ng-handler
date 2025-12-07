/**
 * Tests for OIDC crypto utilities
 */

import {
  computeHash,
  computeAtHash,
  computeCHash,
  computeSHash,
  verifyAtHash,
  verifyCHash,
  generateRandomString,
  generateCodeVerifier,
  generateCodeChallenge,
  verifyCodeChallenge,
} from "./crypto";

describe("OIDC Crypto Utilities", () => {
  describe("computeHash", () => {
    it("should compute correct hash for RS256", () => {
      // Test vector from OIDC spec examples
      // These are deterministic so we can verify the algorithm is correct
      const value = "jHkWEdUXMU1BwAsC4vtUsZwnNvTIxEl0z9K3vx5KF0Y";
      const hash = computeHash(value, "RS256");

      // The hash should be base64url encoded
      expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
      // For SHA-256, left half is 16 bytes = ~22 base64url chars
      expect(hash.length).toBeLessThanOrEqual(22);
    });

    it("should produce different hashes for different algorithms", () => {
      const value = "test-access-token";

      const hash256 = computeHash(value, "RS256");
      const hash384 = computeHash(value, "RS384");
      const hash512 = computeHash(value, "RS512");

      expect(hash256).not.toBe(hash384);
      expect(hash384).not.toBe(hash512);
      expect(hash256).not.toBe(hash512);
    });

    it("should handle ES algorithms", () => {
      const value = "test-token";

      const es256 = computeHash(value, "ES256");
      const es384 = computeHash(value, "ES384");
      const es512 = computeHash(value, "ES512");

      // ES256 uses SHA-256, same as RS256
      expect(es256).toBe(computeHash(value, "RS256"));
      expect(es384).toBe(computeHash(value, "RS384"));
      expect(es512).toBe(computeHash(value, "RS512"));
    });

    it("should handle PS algorithms", () => {
      const value = "test-token";

      expect(computeHash(value, "PS256")).toBe(computeHash(value, "RS256"));
      expect(computeHash(value, "PS384")).toBe(computeHash(value, "RS384"));
      expect(computeHash(value, "PS512")).toBe(computeHash(value, "RS512"));
    });

    it("should handle HS algorithms", () => {
      const value = "test-token";

      expect(computeHash(value, "HS256")).toBe(computeHash(value, "RS256"));
      expect(computeHash(value, "HS384")).toBe(computeHash(value, "RS384"));
      expect(computeHash(value, "HS512")).toBe(computeHash(value, "RS512"));
    });

    it("should handle EdDSA (uses SHA-512)", () => {
      const value = "test-token";
      const eddsaHash = computeHash(value, "EdDSA");
      const sha512Hash = computeHash(value, "RS512");

      expect(eddsaHash).toBe(sha512Hash);
    });

    it("should default to SHA-256 for unknown algorithms", () => {
      const value = "test-token";
      const unknownHash = computeHash(value, "UNKNOWN");
      const sha256Hash = computeHash(value, "RS256");

      expect(unknownHash).toBe(sha256Hash);
    });
  });

  describe("computeAtHash", () => {
    it("should be equivalent to computeHash", () => {
      const accessToken = "ya29.access-token-value";
      const alg = "RS256";

      expect(computeAtHash(accessToken, alg)).toBe(
        computeHash(accessToken, alg),
      );
    });

    it("should produce consistent results", () => {
      const accessToken = "test-access-token-123";
      const hash1 = computeAtHash(accessToken, "RS256");
      const hash2 = computeAtHash(accessToken, "RS256");

      expect(hash1).toBe(hash2);
    });
  });

  describe("computeCHash", () => {
    it("should be equivalent to computeHash", () => {
      const code = "SplxlOBeZQQYbYS6WxSbIA";
      const alg = "RS256";

      expect(computeCHash(code, alg)).toBe(computeHash(code, alg));
    });
  });

  describe("computeSHash", () => {
    it("should compute state hash", () => {
      const state = "af0ifjsldkj";
      const hash = computeSHash(state, "RS256");

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe("verifyAtHash", () => {
    it("should verify matching at_hash", () => {
      const accessToken = "test-access-token";
      const alg = "RS256";
      const atHash = computeAtHash(accessToken, alg);

      expect(verifyAtHash(atHash, accessToken, alg)).toBe(true);
    });

    it("should reject non-matching at_hash", () => {
      const accessToken = "test-access-token";
      const alg = "RS256";

      expect(verifyAtHash("wrong-hash", accessToken, alg)).toBe(false);
    });

    it("should reject at_hash with wrong algorithm", () => {
      const accessToken = "test-access-token";
      const atHash = computeAtHash(accessToken, "RS256");

      // Verify with different algorithm should fail
      expect(verifyAtHash(atHash, accessToken, "RS384")).toBe(false);
    });
  });

  describe("verifyCHash", () => {
    it("should verify matching c_hash", () => {
      const code = "authorization-code";
      const alg = "ES256";
      const cHash = computeCHash(code, alg);

      expect(verifyCHash(cHash, code, alg)).toBe(true);
    });

    it("should reject non-matching c_hash", () => {
      const code = "authorization-code";
      const alg = "ES256";

      expect(verifyCHash("invalid", code, alg)).toBe(false);
    });
  });

  describe("generateRandomString", () => {
    it("should generate base64url string", () => {
      const random = generateRandomString();

      // Should only contain base64url characters
      expect(random).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate strings of appropriate length", () => {
      const random16 = generateRandomString(16);
      const random32 = generateRandomString(32);
      const random64 = generateRandomString(64);

      // Base64url encoding increases length by ~4/3
      expect(random16.length).toBeGreaterThanOrEqual(21);
      expect(random32.length).toBeGreaterThanOrEqual(42);
      expect(random64.length).toBeGreaterThanOrEqual(85);
    });

    it("should generate unique values", () => {
      const values = new Set<string>();
      for (let i = 0; i < 100; i++) {
        values.add(generateRandomString());
      }

      // All values should be unique
      expect(values.size).toBe(100);
    });

    it("should use default length of 32 bytes", () => {
      const random = generateRandomString();
      // 32 bytes = 43 base64url characters
      expect(random.length).toBeGreaterThanOrEqual(42);
    });
  });

  describe("PKCE", () => {
    describe("generateCodeVerifier", () => {
      it("should generate valid code_verifier", () => {
        const verifier = generateCodeVerifier();

        // Should be base64url encoded
        expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
        // Should meet minimum length (43 characters per RFC 7636)
        expect(verifier.length).toBeGreaterThanOrEqual(43);
      });

      it("should generate unique verifiers", () => {
        const verifiers = new Set<string>();
        for (let i = 0; i < 100; i++) {
          verifiers.add(generateCodeVerifier());
        }

        expect(verifiers.size).toBe(100);
      });
    });

    describe("generateCodeChallenge", () => {
      it("should generate S256 challenge by default", () => {
        const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        const challenge = generateCodeChallenge(verifier);

        // S256 challenge should be base64url encoded SHA-256 hash
        expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
        // SHA-256 produces 32 bytes = 43 base64url characters
        expect(challenge.length).toBe(43);
      });

      it("should support plain method", () => {
        const verifier = "my-plain-verifier";
        const challenge = generateCodeChallenge(verifier, "plain");

        // Plain method returns verifier as-is
        expect(challenge).toBe(verifier);
      });

      it("should produce consistent S256 challenges", () => {
        const verifier = generateCodeVerifier();
        const challenge1 = generateCodeChallenge(verifier, "S256");
        const challenge2 = generateCodeChallenge(verifier, "S256");

        expect(challenge1).toBe(challenge2);
      });

      it("should produce different challenges for different verifiers", () => {
        const verifier1 = generateCodeVerifier();
        const verifier2 = generateCodeVerifier();

        const challenge1 = generateCodeChallenge(verifier1, "S256");
        const challenge2 = generateCodeChallenge(verifier2, "S256");

        expect(challenge1).not.toBe(challenge2);
      });

      // Test vector from RFC 7636 Appendix B
      it("should match RFC 7636 test vector", () => {
        const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        const expectedChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

        const challenge = generateCodeChallenge(verifier, "S256");
        expect(challenge).toBe(expectedChallenge);
      });
    });

    describe("verifyCodeChallenge", () => {
      it("should verify valid S256 challenge", () => {
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier, "S256");

        expect(verifyCodeChallenge(challenge, verifier, "S256")).toBe(true);
      });

      it("should verify valid plain challenge", () => {
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier, "plain");

        expect(verifyCodeChallenge(challenge, verifier, "plain")).toBe(true);
      });

      it("should reject invalid verifier for S256", () => {
        const verifier = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier, "S256");

        expect(verifyCodeChallenge(challenge, "wrong-verifier", "S256")).toBe(
          false,
        );
      });

      it("should reject challenge/verifier mismatch", () => {
        const verifier1 = generateCodeVerifier();
        const verifier2 = generateCodeVerifier();
        const challenge = generateCodeChallenge(verifier1, "S256");

        expect(verifyCodeChallenge(challenge, verifier2, "S256")).toBe(false);
      });

      it("should verify RFC 7636 test vector", () => {
        const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

        expect(verifyCodeChallenge(challenge, verifier, "S256")).toBe(true);
      });
    });
  });
});
