/**
 * Tests for CAS Auth
 */

import { CASAuth } from "./auth";
import type {
  CASAuthConfig,
  HttpClient,
  HttpResponse,
  CASSrvConfig,
} from "./types";
import {
  buildServiceValidateSuccess,
  buildServiceValidateError,
  buildSamlValidateSuccess,
} from "@lemonldap-ng/lib-cas";

// Mock HTTP client
function createMockHttpClient(
  responses: Record<string, HttpResponse>,
): HttpClient {
  return {
    async get(url: string): Promise<HttpResponse> {
      for (const [pattern, response] of Object.entries(responses)) {
        if (url.includes(pattern)) {
          return response;
        }
      }
      return { status: 404, body: "Not found" };
    },
    async post(url: string, body: string): Promise<HttpResponse> {
      for (const [pattern, response] of Object.entries(responses)) {
        if (url.includes(pattern)) {
          return response;
        }
      }
      return { status: 404, body: "Not found" };
    },
  };
}

describe("CASAuth", () => {
  const testServerConfig: CASSrvConfig = {
    casSrvMetaDataOptions: {
      casSrvMetaDataOptionsUrl: "https://cas.example.com",
      casSrvMetaDataOptionsDisplayName: "Test CAS Server",
    },
    casSrvMetaDataExportedVars: {
      mail: "mail",
      cn: "cn",
    },
  };

  describe("extractCredentials", () => {
    it("should extract ST ticket from request", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const credentials = auth.extractCredentials({
        url: "http://app.example.com?ticket=ST-12345678-1234-1234-1234-123456789012",
        query: { ticket: "ST-12345678-1234-1234-1234-123456789012" },
      });

      expect(credentials).not.toBeNull();
      expect(credentials?.ticket).toBe(
        "ST-12345678-1234-1234-1234-123456789012",
      );
      expect(credentials?.serverKey).toBe("testCas");
    });

    it("should extract PT ticket from request", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const credentials = auth.extractCredentials({
        query: { ticket: "PT-12345678-1234-1234-1234-123456789012" },
      });

      expect(credentials).not.toBeNull();
      expect(credentials?.ticket).toBe(
        "PT-12345678-1234-1234-1234-123456789012",
      );
    });

    it("should return null when no ticket", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const credentials = auth.extractCredentials({
        query: {},
      });

      expect(credentials).toBeNull();
    });

    it("should return null for invalid ticket format", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const credentials = auth.extractCredentials({
        query: { ticket: "INVALID-ticket" },
      });

      expect(credentials).toBeNull();
    });

    it("should use server from cookie", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: {
          cas1: testServerConfig,
          cas2: { ...testServerConfig },
        },
        casSrvDefault: "cas1",
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const credentials = auth.extractCredentials({
        query: { ticket: "ST-12345678-1234-1234-1234-123456789012" },
        cookies: { lemonldapcassrv: "cas2" },
      });

      expect(credentials?.serverKey).toBe("cas2");
    });

    it("should remove ticket from service URL", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const credentials = auth.extractCredentials({
        url: "http://app.example.com/path?foo=bar&ticket=ST-123",
        query: { ticket: "ST-12345678-1234-1234-1234-123456789012" },
      });

      expect(credentials?.service).not.toContain("ticket=");
    });
  });

  describe("authenticate", () => {
    it("should authenticate with valid ticket", async () => {
      const validateResponse = buildServiceValidateSuccess("dwho", {
        mail: ["dwho@example.com"],
        cn: ["Doctor Who"],
      });

      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({
          serviceValidate: { status: 200, body: validateResponse },
        }),
      });

      const result = await auth.authenticate({
        ticket: "ST-12345",
        service: "http://app.example.com",
        serverKey: "testCas",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.userId).toBe("dwho");
        expect(result.sessionData.mail).toBe("dwho@example.com");
        expect(result.sessionData.cn).toBe("Doctor Who");
        expect(result.sessionData._casSrvCurrent).toBe("testCas");
      }
    });

    it("should handle multi-value attributes", async () => {
      const validateResponse = buildServiceValidateSuccess("dwho", {
        groups: ["admin", "users", "developers"],
      });

      const serverWithGroups: CASSrvConfig = {
        ...testServerConfig,
        casSrvMetaDataExportedVars: {
          groups: "groups",
        },
      };

      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: serverWithGroups },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({
          serviceValidate: { status: 200, body: validateResponse },
        }),
      });

      const result = await auth.authenticate({
        ticket: "ST-12345",
        service: "http://app.example.com",
        serverKey: "testCas",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.sessionData.groups).toEqual([
          "admin",
          "users",
          "developers",
        ]);
      }
    });

    it("should fail with invalid ticket", async () => {
      const validateResponse = buildServiceValidateError(
        "INVALID_TICKET",
        "Ticket not found",
      );

      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({
          serviceValidate: { status: 200, body: validateResponse },
        }),
      });

      const result = await auth.authenticate({
        ticket: "ST-invalid",
        service: "http://app.example.com",
        serverKey: "testCas",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_TICKET");
      }
    });

    it("should fail with unknown server", async () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const result = await auth.authenticate({
        ticket: "ST-12345",
        service: "http://app.example.com",
        serverKey: "unknownCas",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unknown CAS server");
      }
    });

    it("should handle HTTP errors", async () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({
          serviceValidate: { status: 500, body: "Server error" },
        }),
      });

      const result = await auth.authenticate({
        ticket: "ST-12345",
        service: "http://app.example.com",
        serverKey: "testCas",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("HTTP_ERROR");
      }
    });

    it("should use SAML validation when configured", async () => {
      const validateResponse = buildSamlValidateSuccess("dwho", {
        mail: ["dwho@example.com"],
      });

      const serverWithSaml: CASSrvConfig = {
        casSrvMetaDataOptions: {
          ...testServerConfig.casSrvMetaDataOptions,
          casSrvMetaDataOptionsSamlValidate: true,
        },
        casSrvMetaDataExportedVars: testServerConfig.casSrvMetaDataExportedVars,
      };

      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: serverWithSaml },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({
          samlValidate: { status: 200, body: validateResponse },
        }),
      });

      const result = await auth.authenticate({
        ticket: "ST-12345",
        service: "http://app.example.com",
        serverKey: "testCas",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("buildLoginUrl", () => {
    it("should build login URL with service", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const url = auth.buildLoginUrl();

      expect(url).toContain("https://cas.example.com/login");
      expect(url).toContain("service=http%3A%2F%2Fapp.example.com");
    });

    it("should add renew parameter", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const url = auth.buildLoginUrl({ renew: true });

      expect(url).toContain("renew=true");
    });

    it("should add gateway parameter", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const url = auth.buildLoginUrl({ gateway: true });

      expect(url).toContain("gateway=true");
    });

    it("should use custom return URL", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const url = auth.buildLoginUrl({ returnUrl: "http://other.example.com" });

      expect(url).toContain("service=http%3A%2F%2Fother.example.com");
    });

    it("should throw error without server", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: {},
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      expect(() => auth.buildLoginUrl()).toThrow("No CAS server specified");
    });

    it("should use server from config renew setting", () => {
      const serverWithRenew: CASSrvConfig = {
        casSrvMetaDataOptions: {
          ...testServerConfig.casSrvMetaDataOptions,
          casSrvMetaDataOptionsRenew: true,
        },
      };

      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: serverWithRenew },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const url = auth.buildLoginUrl();

      expect(url).toContain("renew=true");
    });
  });

  describe("buildLogoutUrl", () => {
    it("should build logout URL", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const url = auth.buildLogoutUrl();

      expect(url).toBe("https://cas.example.com/logout");
    });

    it("should add return URL", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { testCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const url = auth.buildLogoutUrl({
        returnUrl: "http://app.example.com/logged-out",
      });

      expect(url).toContain(
        "service=http%3A%2F%2Fapp.example.com%2Flogged-out",
      );
    });
  });

  describe("getServerList", () => {
    it("should return list of configured servers", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: {
          cas1: testServerConfig,
          cas2: {
            casSrvMetaDataOptions: {
              casSrvMetaDataOptionsUrl: "https://cas2.example.com",
              casSrvMetaDataOptionsDisplayName: "CAS Server 2",
            },
          },
        },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      const servers = auth.getServerList();

      expect(servers).toHaveLength(2);
      expect(servers.find((s) => s.confKey === "cas1")?.displayName).toBe(
        "Test CAS Server",
      );
      expect(servers.find((s) => s.confKey === "cas2")?.displayName).toBe(
        "CAS Server 2",
      );
    });
  });

  describe("getDefaultServer", () => {
    it("should return configured default", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: {
          cas1: testServerConfig,
          cas2: testServerConfig,
        },
        casSrvDefault: "cas2",
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      expect(auth.getDefaultServer()).toBe("cas2");
    });

    it("should return single server as default", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: { onlyCas: testServerConfig },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      expect(auth.getDefaultServer()).toBe("onlyCas");
    });

    it("should return null when multiple servers without default", () => {
      const auth = new CASAuth({
        casSrvMetaDataOptions: {
          cas1: testServerConfig,
          cas2: testServerConfig,
        },
        serviceUrl: "http://app.example.com",
        httpClient: createMockHttpClient({}),
      });

      expect(auth.getDefaultServer()).toBeNull();
    });
  });
});
