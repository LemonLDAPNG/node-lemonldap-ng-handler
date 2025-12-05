/**
 * Tests for @lemonldap-ng/message-broker-web
 */

describe("@lemonldap-ng/message-broker-web", () => {
  const WebBroker = require("..");

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
    it("should initialize without server URL", () => {
      const broker = new WebBroker({}, mockLogger);
      expect(broker).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("no server URL configured"),
      );
    });

    it("should initialize with server URL", () => {
      const broker = new WebBroker(
        { server: "http://localhost:8080" },
        mockLogger,
      );
      expect(broker).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("http://localhost:8080"),
      );
    });

    it("should accept custom poll interval", () => {
      const broker = new WebBroker(
        { server: "http://localhost:8080", every: 10 },
        mockLogger,
      );
      expect(broker).toBeDefined();
    });
  });

  describe("subscribe", () => {
    it("should track subscriptions", async () => {
      const broker = new WebBroker({}, mockLogger);
      await broker.subscribe("test-channel");
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("subscribed to test-channel"),
      );
    });

    it("should not duplicate subscriptions", async () => {
      const broker = new WebBroker({}, mockLogger);
      await broker.subscribe("test-channel");
      await broker.subscribe("test-channel");
      // Should only log once
      const subscribeCalls = mockLogger.debug.mock.calls.filter((call) =>
        call[0].includes("subscribed to test-channel"),
      );
      expect(subscribeCalls.length).toBe(1);
    });
  });

  describe("getNextMessage", () => {
    it("should return undefined when no messages", async () => {
      const broker = new WebBroker({}, mockLogger);
      await broker.subscribe("test-channel");
      const msg = await broker.getNextMessage("test-channel");
      expect(msg).toBeUndefined();
    });
  });

  describe("publish without server", () => {
    it("should skip publish when no server configured", async () => {
      const broker = new WebBroker({}, mockLogger);
      await broker.publish("test-channel", { action: "test" });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("publish skipped"),
      );
    });
  });

  describe("close", () => {
    it("should clean up resources", () => {
      const broker = new WebBroker(
        { server: "http://localhost:8080" },
        mockLogger,
      );
      broker.close();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("closed"),
      );
    });
  });
});
