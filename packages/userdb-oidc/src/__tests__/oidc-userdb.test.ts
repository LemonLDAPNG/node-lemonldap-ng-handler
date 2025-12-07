/**
 * Tests for OIDC UserDB module
 */

import { OIDCUserDB, extractOIDCUserDBConfig, OIDCClaims } from "../index";
import type { LLNG_Conf, LLNG_Logger, LLNG_Session } from "@lemonldap-ng/types";

// Silent logger for tests
const silentLogger = {
  error: () => {},
  warn: () => {},
  notice: () => {},
  info: () => {},
  debug: () => {},
} as LLNG_Logger;

describe("extractOIDCUserDBConfig", () => {
  it("should extract empty config from minimal conf", () => {
    const conf = {} as LLNG_Conf;
    const config = extractOIDCUserDBConfig(conf);

    expect(config.oidcOPMetaDataExportedVars).toEqual({});
    expect(config.exportedVars).toBeUndefined();
    expect(config.multiValuesSeparator).toBe(";");
  });

  it("should extract exportedVars from conf", () => {
    const conf = {
      exportedVars: {
        uid: "sub",
        mail: "email",
      },
      multiValuesSeparator: "|",
    } as unknown as LLNG_Conf;

    const config = extractOIDCUserDBConfig(conf);

    expect(config.exportedVars).toEqual({
      uid: "sub",
      mail: "email",
    });
    expect(config.multiValuesSeparator).toBe("|");
  });

  it("should extract OP-specific exportedVars", () => {
    const conf = {
      oidcOPMetaData: {
        google: {
          oidcOPMetaDataExportedVars: {
            uid: "sub",
            mail: "email",
            name: "name",
          },
        },
        github: {
          oidcOPMetaDataExportedVars: {
            uid: "login",
            mail: "email",
          },
        },
      },
    } as unknown as LLNG_Conf;

    const config = extractOIDCUserDBConfig(conf);

    expect(config.oidcOPMetaDataExportedVars?.google).toEqual({
      uid: "sub",
      mail: "email",
      name: "name",
    });
    expect(config.oidcOPMetaDataExportedVars?.github).toEqual({
      uid: "login",
      mail: "email",
    });
  });
});

describe("OIDCUserDB", () => {
  let userdb: OIDCUserDB;

  const conf = {
    oidcOPMetaData: {
      google: {
        oidcOPMetaDataExportedVars: {
          uid: "sub",
          mail: "email",
          cn: "name",
          givenName: "given_name",
          sn: "family_name",
        },
      },
    },
    exportedVars: {
      uid: "sub",
      mail: "email",
    },
    multiValuesSeparator: ";",
  } as unknown as LLNG_Conf;

  beforeEach(async () => {
    userdb = new OIDCUserDB();
    await userdb.init(conf, silentLogger);
  });

  describe("init", () => {
    it("should initialize with valid config", async () => {
      const db = new OIDCUserDB();
      await db.init(conf, silentLogger);
      expect(db.name).toBe("OpenIDConnect");
    });

    it("should initialize with empty config", async () => {
      const db = new OIDCUserDB();
      await db.init({} as LLNG_Conf, silentLogger);
      expect(db.name).toBe("OpenIDConnect");
    });
  });

  describe("getUser", () => {
    it("should return null when no claims set", async () => {
      const result = await userdb.getUser("user123");
      expect(result).toBeNull();
    });

    it("should return user data from claims", async () => {
      const claims: OIDCClaims = {
        opConfKey: "google",
        idTokenClaims: {
          sub: "google-user-123",
          email: "user@example.com",
        },
        userInfo: {
          sub: "google-user-123",
          email: "user@example.com",
          name: "Test User",
          given_name: "Test",
          family_name: "User",
        },
      };

      userdb.setOIDCClaims(claims);
      const result = await userdb.getUser("google-user-123");

      expect(result).not.toBeNull();
      expect(result!.uid).toBe("google-user-123");
      expect(result!.attributes.uid).toBe("google-user-123");
      expect(result!.attributes.mail).toBe("user@example.com");
      expect(result!.attributes.cn).toBe("Test User");
      expect(result!.attributes.givenName).toBe("Test");
      expect(result!.attributes.sn).toBe("User");
    });

    it("should use default mappings when no exportedVars", async () => {
      const db = new OIDCUserDB();
      await db.init({} as LLNG_Conf, silentLogger);

      const claims: OIDCClaims = {
        userInfo: {
          sub: "user456",
          email: "test@example.com",
          name: "Default User",
        },
      };

      db.setOIDCClaims(claims);
      const result = await db.getUser("user456");

      expect(result).not.toBeNull();
      expect(result!.attributes.uid).toBe("user456");
      expect(result!.attributes.mail).toBe("test@example.com");
      expect(result!.attributes.cn).toBe("Default User");
    });

    it("should merge ID token and userinfo claims", async () => {
      const claims: OIDCClaims = {
        opConfKey: "google",
        idTokenClaims: {
          sub: "user789",
          aud: "client-id",
          iss: "https://accounts.google.com",
        },
        userInfo: {
          sub: "user789",
          email: "user@gmail.com",
          name: "Gmail User",
          given_name: "Gmail",
          family_name: "User",
        },
      };

      userdb.setOIDCClaims(claims);
      const result = await userdb.getUser("user789");

      expect(result).not.toBeNull();
      expect(result!.uid).toBe("user789");
      expect(result!.attributes.mail).toBe("user@gmail.com");
      // Internal OIDC claims should also be present
      expect(result!.attributes._oidc_iss).toBe("https://accounts.google.com");
    });

    it("should handle array values", async () => {
      const claims: OIDCClaims = {
        opConfKey: "google",
        userInfo: {
          sub: "user-array",
          email: "user@example.com",
          groups: ["admin", "users", "developers"],
        },
      };

      userdb.setOIDCClaims(claims);
      const result = await userdb.getUser("user-array");

      expect(result).not.toBeNull();
      expect(result!.attributes._oidc_groups).toEqual([
        "admin",
        "users",
        "developers",
      ]);
    });

    it("should handle multi-value separator", async () => {
      const db = new OIDCUserDB();
      await db.init(
        {
          exportedVars: { groups: "groups" },
          multiValuesSeparator: ";",
        } as unknown as LLNG_Conf,
        silentLogger,
      );

      const claims: OIDCClaims = {
        userInfo: {
          sub: "user-multi",
          groups: "admin;users;developers",
        },
      };

      db.setOIDCClaims(claims);
      const result = await db.getUser("user-multi");

      expect(result).not.toBeNull();
      expect(result!.attributes.groups).toEqual([
        "admin",
        "users",
        "developers",
      ]);
    });
  });

  describe("setSessionInfo", () => {
    it("should set session info from user data", async () => {
      const claims: OIDCClaims = {
        opConfKey: "google",
        userInfo: {
          sub: "session-user",
          email: "session@example.com",
          name: "Session User",
          given_name: "Session",
          family_name: "User",
        },
      };

      userdb.setOIDCClaims(claims);
      const userData = await userdb.getUser("session-user");
      expect(userData).not.toBeNull();

      const session = {} as LLNG_Session;
      userdb.setSessionInfo(session, userData!);

      expect(session.uid).toBe("session-user");
      expect(session._user).toBe("session-user");
      expect((session as Record<string, unknown>).mail).toBe(
        "session@example.com",
      );
      expect((session as Record<string, unknown>).cn).toBe("Session User");
      expect((session as Record<string, unknown>)._oidcOP).toBe("google");
      expect((session as Record<string, unknown>)._oidcSub).toBe(
        "session-user",
      );
    });

    it("should not overwrite existing _user", async () => {
      const claims: OIDCClaims = {
        userInfo: {
          sub: "new-user",
          email: "new@example.com",
        },
      };

      userdb.setOIDCClaims(claims);
      const userData = await userdb.getUser("new-user");

      const session = {
        _user: "existing-user",
      } as unknown as LLNG_Session;

      userdb.setSessionInfo(session, userData!);

      expect(session._user).toBe("existing-user");
      expect(session.uid).toBe("new-user");
    });

    it("should not include internal _oidc_ attributes in session", async () => {
      const claims: OIDCClaims = {
        opConfKey: "google",
        idTokenClaims: {
          sub: "internal-user",
          iss: "https://issuer.example.com",
          aud: "client-id",
          exp: 1234567890,
        },
        userInfo: {
          sub: "internal-user",
          email: "internal@example.com",
        },
      };

      userdb.setOIDCClaims(claims);
      const userData = await userdb.getUser("internal-user");

      const session = {} as LLNG_Session;
      userdb.setSessionInfo(session, userData!);

      // These should not be in session
      expect((session as Record<string, unknown>)._oidc_iss).toBeUndefined();
      expect((session as Record<string, unknown>)._oidc_aud).toBeUndefined();
      expect((session as Record<string, unknown>)._oidc_exp).toBeUndefined();

      // But these should be
      expect((session as Record<string, unknown>)._oidcOP).toBe("google");
      expect((session as Record<string, unknown>)._oidcSub).toBe(
        "internal-user",
      );
    });
  });

  describe("close", () => {
    it("should close without error", async () => {
      await expect(userdb.close()).resolves.toBeUndefined();
    });
  });
});
