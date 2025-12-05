/**
 * Redis Message Broker for LemonLDAP::NG handler
 * Port of Lemonldap::NG::Common::MessageBroker::Redis
 *
 * Uses Redis pub/sub for distributed message passing.
 * Supports both simple server URL and Redis Sentinel configuration.
 *
 * Configuration options (passed via messageBrokerOptions):
 * - server: Simple connection string "host:port" or "redis://host:port"
 * - sentinels: Array of sentinel nodes for HA setup
 *   Format: ["host1:port1", "host2:port2"] (Perl style)
 *   or: [{ host: "host1", port: 26379 }] (ioredis style)
 * - service/name: Sentinel master name (service for Perl compat, name for ioredis)
 * - reconnect: Max reconnection attempts (default: 3600 like Perl)
 * - every: Reconnection interval in microseconds (default: 1000000 = 1s)
 */

import Redis, { RedisOptions } from "ioredis";
import {
  WAIT_POLL_INTERVAL_MS,
  type MessageBroker,
  type BrokerMessage,
  type MessageBrokerOptions,
  type LLNG_Logger,
} from "@lemonldap-ng/message-broker";

export default class RedisBroker implements MessageBroker {
  private logger: LLNG_Logger;
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private messageQueue: Map<string, BrokerMessage[]> = new Map();
  private subscriptions: Set<string> = new Set();
  private redisOptions: RedisOptions;

  constructor(conf: MessageBrokerOptions, logger: LLNG_Logger) {
    this.logger = logger;
    this.redisOptions = this.buildRedisOptions(conf);
    this.logger.debug(
      `RedisBroker initialized with config: ${this.describeConfig()}`,
    );
  }

  /**
   * Build ioredis options from LemonLDAP::NG messageBrokerOptions
   */
  private buildRedisOptions(conf: MessageBrokerOptions): RedisOptions {
    const options: RedisOptions = {
      lazyConnect: true,
    };

    // Handle reconnection parameters (Perl defaults: reconnect=3600, every=1000000µs)
    const reconnect = conf.reconnect ?? 3600;
    const every = conf.every ?? 1000000;
    options.maxRetriesPerRequest = reconnect;
    options.retryStrategy = (times: number) => {
      if (times > reconnect) return null;
      // Perl 'every' is in microseconds, convert to milliseconds for ioredis
      return Math.floor(every / 1000);
    };

    // Check for Sentinel configuration
    if (conf.sentinels) {
      // Parse sentinels - can be Perl format ["host:port"] or ioredis format [{host, port}]
      options.sentinels = this.parseSentinels(conf.sentinels);
      // Perl uses "service", ioredis uses "name"
      options.name = conf.service || conf.name || "mymaster";
      return options;
    }

    // Simple server connection
    if (conf.server) {
      const server = conf.server;
      // Handle different formats: "host:port", "redis://host:port"
      if (server.startsWith("redis://") || server.startsWith("rediss://")) {
        // URL format - ioredis handles this directly
        return { ...options, ...this.parseRedisUrl(server) };
      } else {
        // Perl format "host:port"
        const [host, portStr] = server.split(":");
        options.host = host || "localhost";
        options.port = parseInt(portStr, 10) || 6379;
      }
    } else {
      options.host = "localhost";
      options.port = 6379;
    }

    return options;
  }

  /**
   * Parse Redis URL to options
   */
  private parseRedisUrl(url: string): RedisOptions {
    try {
      const parsed = new URL(url);
      const options: RedisOptions = {
        host: parsed.hostname || "localhost",
        port: parseInt(parsed.port, 10) || 6379,
      };
      if (parsed.password) {
        options.password = decodeURIComponent(parsed.password);
      }
      if (parsed.username && parsed.username !== "default") {
        options.username = decodeURIComponent(parsed.username);
      }
      if (parsed.pathname && parsed.pathname.length > 1) {
        options.db = parseInt(parsed.pathname.slice(1), 10);
      }
      return options;
    } catch {
      return { host: "localhost", port: 6379 };
    }
  }

  /**
   * Parse sentinels from Perl or ioredis format
   */
  private parseSentinels(
    sentinels: unknown,
  ): Array<{ host: string; port: number }> {
    if (!Array.isArray(sentinels)) {
      return [];
    }

    return sentinels.map((s) => {
      if (typeof s === "string") {
        // Perl format: "host:port"
        const [host, portStr] = s.split(":");
        return {
          host: host || "localhost",
          port: parseInt(portStr, 10) || 26379,
        };
      } else if (typeof s === "object" && s !== null) {
        // ioredis format: { host, port }
        const sentinel = s as { host?: string; port?: number };
        return {
          host: sentinel.host || "localhost",
          port: sentinel.port || 26379,
        };
      }
      return { host: "localhost", port: 26379 };
    });
  }

  /**
   * Describe current configuration for logging
   */
  private describeConfig(): string {
    if (this.redisOptions.sentinels) {
      const sentinels = this.redisOptions.sentinels
        .map((s) => `${s.host}:${s.port}`)
        .join(",");
      return `sentinel:[${sentinels}] master:${this.redisOptions.name}`;
    }
    return `${this.redisOptions.host}:${this.redisOptions.port}`;
  }

  /**
   * Ensure Redis connections are established
   */
  private async ensureConnected(): Promise<void> {
    if (!this.publisher) {
      this.publisher = new Redis(this.redisOptions);
      await this.publisher.connect();
      this.logger.debug("Redis publisher connected");
    }

    if (!this.subscriber) {
      this.subscriber = new Redis(this.redisOptions);
      await this.subscriber.connect();

      // Set up message handler
      this.subscriber.on("message", (channel: string, message: string) => {
        this.handleMessage(channel, message);
      });

      this.logger.debug("Redis subscriber connected");
    }
  }

  /**
   * Handle incoming Redis message
   */
  private handleMessage(channel: string, message: string): void {
    try {
      const msg = JSON.parse(message) as BrokerMessage;

      if (!this.messageQueue.has(channel)) {
        this.messageQueue.set(channel, []);
      }
      this.messageQueue.get(channel)!.push(msg);

      this.logger.debug(`Redis: received message on ${channel}: ${msg.action}`);
    } catch (e) {
      this.logger.error(`Redis: failed to parse message: ${e}`);
    }
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, msg: BrokerMessage): Promise<void> {
    await this.ensureConnected();

    try {
      const message = JSON.stringify(msg);
      await this.publisher!.publish(channel, message);
      this.logger.debug(`Redis: published to ${channel}: ${msg.action}`);
    } catch (e) {
      this.logger.error(`Redis: failed to publish: ${e}`);
      throw e;
    }
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel: string): Promise<void> {
    await this.ensureConnected();

    if (this.subscriptions.has(channel)) {
      return;
    }

    try {
      await this.subscriber!.subscribe(channel);
      this.subscriptions.add(channel);
      this.messageQueue.set(channel, []);
      this.logger.debug(`Redis: subscribed to ${channel}`);
    } catch (e) {
      this.logger.error(`Redis: failed to subscribe: ${e}`);
      throw e;
    }
  }

  /**
   * Get next message from channel (non-blocking)
   */
  async getNextMessage(
    channel: string,
    _delay?: number,
  ): Promise<BrokerMessage | undefined> {
    const queue = this.messageQueue.get(channel);
    if (queue && queue.length > 0) {
      return queue.shift();
    }
    return undefined;
  }

  /**
   * Wait for next message from channel (blocking)
   */
  async waitForNextMessage(channel: string): Promise<BrokerMessage> {
    return new Promise((resolve) => {
      const check = () => {
        const queue = this.messageQueue.get(channel);
        if (queue && queue.length > 0) {
          resolve(queue.shift()!);
        } else {
          setTimeout(check, WAIT_POLL_INTERVAL_MS);
        }
      };
      check();
    });
  }

  /**
   * Close Redis connections
   */
  async close(): Promise<void> {
    if (this.publisher) {
      await this.publisher.quit();
      this.publisher = null;
    }
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    this.logger.debug("Redis connections closed");
  }
}
