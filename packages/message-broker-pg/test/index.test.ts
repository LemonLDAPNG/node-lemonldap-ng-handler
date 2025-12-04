/**
 * Tests for @lemonldap-ng/message-broker-pg
 *
 * Unit tests that don't require a running PostgreSQL instance.
 */

describe("@lemonldap-ng/message-broker-pg", () => {
  const PgBroker = require("..");

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
      const broker = new PgBroker({}, mockLogger);
      expect(broker).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("PgBroker initialized")
      );
    });

    it("should parse DBI connection string", () => {
      const broker = new PgBroker(
        {
          dbiChain: "dbi:Pg:dbname=llng;host=localhost;port=5432",
          dbiUser: "llng",
          dbiPassword: "secret",
        },
        mockLogger
      );
      expect(broker).toBeDefined();
      // Password should be masked in log
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(":***@")
      );
    });

    it("should accept server URL directly", () => {
      const broker = new PgBroker(
        { server: "postgresql://localhost:5432/mydb" },
        mockLogger
      );
      expect(broker).toBeDefined();
    });
  });

  describe("message queue", () => {
    it("should initialize empty queues", () => {
      const broker = new PgBroker({}, mockLogger);
      expect(broker).toBeDefined();
    });
  });
});
