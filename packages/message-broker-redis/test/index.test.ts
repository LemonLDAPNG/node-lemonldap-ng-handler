/**
 * Tests for @lemonldap-ng/message-broker-redis
 *
 * Unit tests that don't require a running Redis instance.
 */

describe("@lemonldap-ng/message-broker-redis", () => {
  const RedisBroker = require("..");

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
    it("should initialize with default options", () => {
      const broker = new RedisBroker({}, mockLogger);
      expect(broker).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("RedisBroker initialized")
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("localhost:6379")
      );
    });

    it("should accept redis:// URL format", () => {
      const broker = new RedisBroker(
        { server: "redis://custom:6380" },
        mockLogger
      );
      expect(broker).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("custom:6380")
      );
    });

    it("should accept Perl-style host:port format", () => {
      const broker = new RedisBroker(
        { server: "localhost:63379" },
        mockLogger
      );
      expect(broker).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("localhost:63379")
      );
    });

    it("should accept Sentinel configuration with Perl-style string array", () => {
      const broker = new RedisBroker(
        {
          sentinels: ["sentinel1:26379", "sentinel2:26379"],
          service: "mymaster",
        },
        mockLogger
      );
      expect(broker).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("sentinel:")
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("sentinel1:26379")
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("mymaster")
      );
    });

    it("should accept Sentinel configuration with ioredis-style object array", () => {
      const broker = new RedisBroker(
        {
          sentinels: [
            { host: "sentinel1", port: 26379 },
            { host: "sentinel2", port: 26379 },
          ],
          name: "mymaster",
        },
        mockLogger
      );
      expect(broker).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("sentinel:")
      );
    });

    it("should use 'service' as sentinel master name (Perl compatibility)", () => {
      const broker = new RedisBroker(
        {
          sentinels: ["sentinel1:26379"],
          service: "llng-master",
        },
        mockLogger
      );
      expect(broker).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("llng-master")
      );
    });
  });

  describe("message handling", () => {
    it("should create message queue for channel", () => {
      const broker = new RedisBroker({}, mockLogger);
      // The queue is created when subscribing
      expect(broker).toBeDefined();
    });
  });
});
