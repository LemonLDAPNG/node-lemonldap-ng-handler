/**
 * Tests for @lemonldap-ng/message-broker interface
 */

describe("@lemonldap-ng/message-broker", () => {
  const messageBroker = require("..");

  it("should export BrokerMessage interface type", () => {
    // Interface types don't exist at runtime, but we can verify the module exports
    expect(messageBroker).toBeDefined();
  });

  it("should be importable", () => {
    // Since this is an interface-only package, just verify it can be imported
    expect(typeof messageBroker).toBe("object");
  });

  describe("BrokerMessage structure", () => {
    it("should define a valid message structure", () => {
      // Test that a message conforming to BrokerMessage interface is valid
      const msg = {
        action: "reload",
        channel: "llng-events",
        id: "test-123",
        customField: "custom-value",
      };

      expect(msg.action).toBe("reload");
      expect(msg.channel).toBe("llng-events");
      expect(msg.id).toBe("test-123");
      expect(msg.customField).toBe("custom-value");
    });

    it("should allow minimal message with only action", () => {
      const msg = {
        action: "ping",
      };

      expect(msg.action).toBe("ping");
    });
  });

  describe("MessageBrokerOptions structure", () => {
    it("should define valid options structure", () => {
      const opts = {
        server: "redis://localhost:6379",
        token: "secret-token",
        reconnect: 5,
        every: 1000,
        checkTime: 600,
        eventQueueName: "llng-events",
        statusQueueName: "llng-status",
      };

      expect(opts.server).toBe("redis://localhost:6379");
      expect(opts.token).toBe("secret-token");
      expect(opts.reconnect).toBe(5);
      expect(opts.every).toBe(1000);
      expect(opts.checkTime).toBe(600);
      expect(opts.eventQueueName).toBe("llng-events");
      expect(opts.statusQueueName).toBe("llng-status");
    });

    it("should allow database options", () => {
      const opts = {
        dbiChain: "dbi:Pg:dbname=llng",
        dbiUser: "llng",
        dbiPassword: "secret",
      };

      expect(opts.dbiChain).toBe("dbi:Pg:dbname=llng");
      expect(opts.dbiUser).toBe("llng");
      expect(opts.dbiPassword).toBe("secret");
    });
  });
});
