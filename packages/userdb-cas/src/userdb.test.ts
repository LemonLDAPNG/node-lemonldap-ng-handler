/**
 * Tests for CAS UserDB
 */

import { CASUserDB, SessionData, CASUserInfo } from "./index";

describe("CASUserDB", () => {
  describe("constructor", () => {
    it("should create instance with default config", () => {
      const userdb = new CASUserDB();
      expect(userdb.name).toBe("CAS");
    });

    it("should create instance with custom config", () => {
      const userdb = new CASUserDB({
        exportedVars: { mail: "email" },
      });
      expect(userdb.name).toBe("CAS");
    });
  });

  describe("getUser", () => {
    it("should return user info from session", async () => {
      const userdb = new CASUserDB();
      const session: SessionData = {
        _user: "dwho",
        _casAttributes: {
          mail: ["dwho@example.com"],
          cn: ["Doctor Who"],
        },
      };

      const result = await userdb.getUser("dwho", session);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe("dwho");
      expect(result?.attributes.mail).toEqual(["dwho@example.com"]);
      expect(result?.attributes.cn).toEqual(["Doctor Who"]);
    });

    it("should return empty attributes when none stored", async () => {
      const userdb = new CASUserDB();
      const session: SessionData = {
        _user: "dwho",
      };

      const result = await userdb.getUser("dwho", session);

      expect(result).not.toBeNull();
      expect(result?.userId).toBe("dwho");
      expect(result?.attributes).toEqual({});
    });
  });

  describe("setSessionInfo", () => {
    it("should set basic session info", async () => {
      const userdb = new CASUserDB();
      const session: SessionData = {};
      const userInfo: CASUserInfo = {
        userId: "dwho",
        attributes: {
          mail: ["dwho@example.com"],
        },
      };

      await userdb.setSessionInfo(session, userInfo);

      expect(session._user).toBe("dwho");
      expect(session._casAttributes).toEqual({
        mail: ["dwho@example.com"],
      });
    });

    it("should map attributes using exportedVars", async () => {
      const userdb = new CASUserDB({
        exportedVars: {
          email: "mail",
          fullName: "cn",
          userGroups: "groups",
        },
      });

      const session: SessionData = {};
      const userInfo: CASUserInfo = {
        userId: "dwho",
        attributes: {
          mail: ["dwho@example.com"],
          cn: ["Doctor Who"],
          groups: ["admin", "users"],
        },
      };

      await userdb.setSessionInfo(session, userInfo);

      expect(session.email).toBe("dwho@example.com");
      expect(session.fullName).toBe("Doctor Who");
      expect(session.userGroups).toEqual(["admin", "users"]);
    });

    it("should handle single value as string", async () => {
      const userdb = new CASUserDB({
        exportedVars: {
          mail: "mail",
        },
      });

      const session: SessionData = {};
      const userInfo: CASUserInfo = {
        userId: "dwho",
        attributes: {
          mail: ["dwho@example.com"],
        },
      };

      await userdb.setSessionInfo(session, userInfo);

      expect(session.mail).toBe("dwho@example.com");
      expect(typeof session.mail).toBe("string");
    });

    it("should handle multiple values as array", async () => {
      const userdb = new CASUserDB({
        exportedVars: {
          groups: "memberOf",
        },
      });

      const session: SessionData = {};
      const userInfo: CASUserInfo = {
        userId: "dwho",
        attributes: {
          memberOf: [
            "cn=admin,dc=example,dc=com",
            "cn=users,dc=example,dc=com",
          ],
        },
      };

      await userdb.setSessionInfo(session, userInfo);

      expect(Array.isArray(session.groups)).toBe(true);
      expect(session.groups).toEqual([
        "cn=admin,dc=example,dc=com",
        "cn=users,dc=example,dc=com",
      ]);
    });

    it("should skip missing attributes", async () => {
      const userdb = new CASUserDB({
        exportedVars: {
          mail: "mail",
          phone: "telephoneNumber",
        },
      });

      const session: SessionData = {};
      const userInfo: CASUserInfo = {
        userId: "dwho",
        attributes: {
          mail: ["dwho@example.com"],
        },
      };

      await userdb.setSessionInfo(session, userInfo);

      expect(session.mail).toBe("dwho@example.com");
      expect(session.phone).toBeUndefined();
    });

    it("should skip empty attribute values", async () => {
      const userdb = new CASUserDB({
        exportedVars: {
          mail: "mail",
        },
      });

      const session: SessionData = {};
      const userInfo: CASUserInfo = {
        userId: "dwho",
        attributes: {
          mail: [],
        },
      };

      await userdb.setSessionInfo(session, userInfo);

      expect(session.mail).toBeUndefined();
    });
  });

  describe("lifecycle", () => {
    it("should init without error", async () => {
      const userdb = new CASUserDB();
      await expect(userdb.init()).resolves.not.toThrow();
    });

    it("should close without error", async () => {
      const userdb = new CASUserDB();
      await expect(userdb.close()).resolves.not.toThrow();
    });
  });

  describe("logging", () => {
    it("should call logger when configured", async () => {
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const userdb = new CASUserDB({ logger });

      await userdb.init();
      expect(logger.debug).toHaveBeenCalledWith("CAS UserDB initialized");

      await userdb.setSessionInfo({}, { userId: "dwho", attributes: {} });
      expect(logger.info).toHaveBeenCalledWith(
        "Session info set for user dwho",
      );

      await userdb.close();
      expect(logger.debug).toHaveBeenCalledWith("CAS UserDB closed");
    });
  });
});
