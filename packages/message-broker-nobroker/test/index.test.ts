/**
 * Tests for @lemonldap-ng/message-broker-nobroker
 */

describe("@lemonldap-ng/message-broker-nobroker", () => {
  const NoBroker = require("..");

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    notice: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize without errors", () => {
      const broker = new NoBroker({}, mockLogger);
      expect(broker).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "NoBroker initialized (single instance mode)"
      );
    });

    it("should accept configuration options", () => {
      const conf = {
        server: "ignored",
        checkTime: 600,
      };
      const broker = new NoBroker(conf, mockLogger);
      expect(broker).toBeDefined();
    });
  });

  describe("publish", () => {
    it("should not throw and log debug message", async () => {
      const broker = new NoBroker({}, mockLogger);
      const msg = { action: "reload" };

      await expect(broker.publish("llng-events", msg)).resolves.toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("publish to llng-events ignored")
      );
    });

    it("should handle messages with various fields", async () => {
      const broker = new NoBroker({}, mockLogger);
      const msg = {
        action: "newSession",
        id: "session-123",
        channel: "llng-events",
        customData: { user: "test" },
      };

      await expect(broker.publish("llng-events", msg)).resolves.toBeUndefined();
    });
  });

  describe("subscribe", () => {
    it("should track subscription and log", async () => {
      const broker = new NoBroker({}, mockLogger);

      await broker.subscribe("llng-events");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("subscribed to llng-events")
      );
    });

    it("should track multiple subscriptions", async () => {
      const broker = new NoBroker({}, mockLogger);

      await broker.subscribe("llng-events");
      await broker.subscribe("llng-status");

      expect(broker.isSubscribed("llng-events")).toBe(true);
      expect(broker.isSubscribed("llng-status")).toBe(true);
      expect(broker.isSubscribed("unknown")).toBe(false);
    });
  });

  describe("getNextMessage", () => {
    it("should always return undefined", async () => {
      const broker = new NoBroker({}, mockLogger);

      await broker.subscribe("llng-events");
      const msg = await broker.getNextMessage("llng-events");

      expect(msg).toBeUndefined();
    });

    it("should return undefined even with delay", async () => {
      const broker = new NoBroker({}, mockLogger);

      const msg = await broker.getNextMessage("llng-events", 1);
      expect(msg).toBeUndefined();
    });
  });

  describe("waitForNextMessage", () => {
    it("should log warning when called", () => {
      const broker = new NoBroker({}, mockLogger);

      // Don't await - it will never resolve
      broker.waitForNextMessage("llng-events");

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("waitForNextMessage called")
      );
    });
  });

  describe("isSubscribed", () => {
    it("should return false for unsubscribed channels", () => {
      const broker = new NoBroker({}, mockLogger);
      expect(broker.isSubscribed("unknown")).toBe(false);
    });

    it("should return true after subscription", async () => {
      const broker = new NoBroker({}, mockLogger);
      await broker.subscribe("test-channel");
      expect(broker.isSubscribed("test-channel")).toBe(true);
    });
  });
});
