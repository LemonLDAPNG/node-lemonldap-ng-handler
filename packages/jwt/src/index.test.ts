const jwt = require("..");

describe("JWT utilities", () => {
  // Sample JWT for testing (not a real token, just for structure testing)
  // Header: {"alg":"RS256","typ":"JWT"}
  // Payload: {"jti":"test-session-id-123","sub":"user@example.com","iat":1234567890}
  const sampleJWT =
    "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJ0ZXN0LXNlc3Npb24taWQtMTIzIiwic3ViIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTIzNDU2Nzg5MH0.signature";

  describe("decodeBase64Url", () => {
    test("should decode standard base64url string", () => {
      // "test" in base64url
      const encoded = "dGVzdA";
      expect(jwt.decodeBase64Url(encoded)).toBe("test");
    });

    test("should handle missing padding", () => {
      // "hello" without padding
      const encoded = "aGVsbG8";
      expect(jwt.decodeBase64Url(encoded)).toBe("hello");
    });

    test("should handle JSON content", () => {
      // {"test":"value"} in base64url
      const encoded = "eyJ0ZXN0IjoidmFsdWUifQ";
      expect(jwt.decodeBase64Url(encoded)).toBe('{"test":"value"}');
    });
  });

  describe("getJWTHeader", () => {
    test("should extract and decode JWT header", () => {
      const header = jwt.getJWTHeader(sampleJWT);
      expect(header).not.toBeNull();
      expect(header.alg).toBe("RS256");
      expect(header.typ).toBe("JWT");
    });

    test("should return null for invalid JWT", () => {
      expect(jwt.getJWTHeader("not-a-jwt")).toBeNull();
    });

    test("should return null for empty string", () => {
      expect(jwt.getJWTHeader("")).toBeNull();
    });
  });

  describe("getJWTPayload", () => {
    test("should extract and decode JWT payload", () => {
      const payload = jwt.getJWTPayload(sampleJWT);
      expect(payload).not.toBeNull();
      expect(payload.jti).toBe("test-session-id-123");
      expect(payload.sub).toBe("user@example.com");
      expect(payload.iat).toBe(1234567890);
    });

    test("should return null for invalid JWT", () => {
      expect(jwt.getJWTPayload("not-a-jwt")).toBeNull();
    });

    test("should return null for JWT with only header", () => {
      expect(jwt.getJWTPayload("eyJhbGciOiJSUzI1NiJ9")).toBeNull();
    });
  });

  describe("getJWTSignature", () => {
    test("should extract JWT signature", () => {
      const signature = jwt.getJWTSignature(sampleJWT);
      expect(signature).toBe("signature");
    });

    test("should return null for JWT without signature", () => {
      expect(jwt.getJWTSignature("header.payload")).toBeNull();
    });

    test("should return null for invalid JWT", () => {
      expect(jwt.getJWTSignature("not-a-jwt")).toBeNull();
    });
  });

  describe("getJWTSignedData", () => {
    test("should return header.payload", () => {
      const signedData = jwt.getJWTSignedData(sampleJWT);
      expect(signedData).toBe(
        "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJ0ZXN0LXNlc3Npb24taWQtMTIzIiwic3ViIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTIzNDU2Nzg5MH0"
      );
    });

    test("should return null for invalid JWT", () => {
      expect(jwt.getJWTSignedData("not-a-jwt")).toBeNull();
    });
  });

  describe("getAccessTokenSessionId", () => {
    test("should extract jti from JWT access token", () => {
      const sessionId = jwt.getAccessTokenSessionId(sampleJWT);
      expect(sessionId).toBe("test-session-id-123");
    });

    test("should return raw session ID if not a JWT", () => {
      const rawSessionId = "abc123def456";
      expect(jwt.getAccessTokenSessionId(rawSessionId)).toBe(rawSessionId);
    });

    test("should return null for JWT without jti", () => {
      // JWT without jti: {"sub":"user@example.com"}
      const jwtWithoutJti =
        "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIn0.sig";
      expect(jwt.getAccessTokenSessionId(jwtWithoutJti)).toBeNull();
    });

    test("should return null for malformed JWT", () => {
      const malformedJwt = "not.valid.base64!@#";
      expect(jwt.getAccessTokenSessionId(malformedJwt)).toBeNull();
    });

    test("should handle empty string", () => {
      expect(jwt.getAccessTokenSessionId("")).toBe("");
    });
  });
});
