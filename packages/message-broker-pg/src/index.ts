/**
 * PostgreSQL Message Broker for LemonLDAP::NG handler
 * Port of Lemonldap::NG::Common::MessageBroker::Pg
 *
 * Uses PostgreSQL LISTEN/NOTIFY for distributed message passing.
 */

import { Client } from "pg";
import { parseDbiChain } from "perl-dbi";
import {
  WAIT_POLL_INTERVAL_MS,
  type MessageBroker,
  type BrokerMessage,
  type MessageBrokerOptions,
  type LLNG_Logger,
} from "@lemonldap-ng/message-broker";

// Valid channel name pattern (PostgreSQL identifiers: alphanumeric and underscores)
const VALID_CHANNEL_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

export default class PgBroker implements MessageBroker {
  private logger: LLNG_Logger;
  private client: Client | null = null;
  private connectionString: string;
  private messageQueue: Map<string, BrokerMessage[]> = new Map();
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts: number;
  private connected: boolean = false;

  constructor(conf: MessageBrokerOptions, logger: LLNG_Logger) {
    this.logger = logger;
    this.reconnectAttempts = conf.reconnect || 3;

    // Build connection string from DBI-style options
    if (conf.dbiChain) {
      this.connectionString = this.buildConnectionString(conf);
    } else if (conf.server) {
      this.connectionString = conf.server;
    } else {
      this.connectionString = "postgresql://localhost/llng";
    }

    this.logger.debug(
      `PgBroker initialized with connection: ${this.maskPassword(this.connectionString)}`,
    );
  }

  /**
   * Mask password in connection string for safe logging
   * Uses string methods to avoid ReDoS vulnerabilities
   */
  private maskPassword(connStr: string): string {
    // Format: postgresql://user:password@host:port/db
    const atIndex = connStr.indexOf("@");
    if (atIndex === -1) return connStr;

    const colonIndex = connStr.indexOf(":", connStr.indexOf("://") + 3);
    if (colonIndex === -1 || colonIndex > atIndex) return connStr;

    return (
      connStr.substring(0, colonIndex) + ":***" + connStr.substring(atIndex)
    );
  }

  /**
   * Validate channel name to prevent SQL injection
   * PostgreSQL NOTIFY/LISTEN don't support parameterized channel names
   */
  private validateChannel(channel: string): void {
    if (!VALID_CHANNEL_PATTERN.test(channel)) {
      throw new Error(
        `Invalid channel name: ${channel}. Must match pattern: ${VALID_CHANNEL_PATTERN}`,
      );
    }
  }

  /**
   * Build PostgreSQL connection string from DBI-style options
   * Uses perl-dbi's parseDbiChain for consistent parsing
   */
  private buildConnectionString(conf: MessageBrokerOptions): string {
    const options = parseDbiChain({
      dbiChain: conf.dbiChain!,
      dbiUser: conf.dbiUser,
      dbiPassword: conf.dbiPassword,
    });

    const host = options.host || "localhost";
    const port = options.port || "5432";
    const dbname = options.database || "llng";

    let connStr = `postgresql://${host}:${port}/${dbname}`;
    if (options.user) {
      const auth = options.password
        ? `${options.user}:${options.password}`
        : options.user;
      connStr = `postgresql://${auth}@${host}:${port}/${dbname}`;
    }

    return connStr;
  }

  /**
   * Ensure PostgreSQL connection is established
   */
  private async ensureConnected(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    this.client = new Client({
      connectionString: this.connectionString,
    });

    try {
      await this.client.connect();
      this.connected = true;

      // Set up notification handler
      this.client.on("notification", (msg) => {
        this.handleNotification(msg.channel, msg.payload || "");
      });

      // Handle connection errors
      this.client.on("error", (err) => {
        this.logger.error(`PgBroker: connection error: ${err.message}`);
        this.connected = false;
      });

      this.logger.debug("PostgreSQL broker connected");
    } catch (e) {
      this.logger.error(`PgBroker: connection failed: ${e}`);
      throw e;
    }
  }

  /**
   * Handle incoming PostgreSQL notification
   */
  private handleNotification(channel: string, payload: string): void {
    try {
      const msg = JSON.parse(payload) as BrokerMessage;

      if (!this.messageQueue.has(channel)) {
        this.messageQueue.set(channel, []);
      }
      this.messageQueue.get(channel)!.push(msg);

      this.logger.debug(`PgBroker: received on ${channel}: ${msg.action}`);
    } catch (e) {
      this.logger.error(`PgBroker: failed to parse notification: ${e}`);
    }
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, msg: BrokerMessage): Promise<void> {
    this.validateChannel(channel);
    await this.ensureConnected();

    try {
      const payload = JSON.stringify(msg);
      // PostgreSQL NOTIFY doesn't support parameterized queries for the payload.
      // We must use manual escaping. Single quotes are escaped by doubling them.
      // The channel name is validated by validateChannel() above.
      const escapedPayload = payload.replace(/'/g, "''");
      await this.client!.query(`NOTIFY ${channel}, '${escapedPayload}'`);
      this.logger.debug(`PgBroker: published to ${channel}: ${msg.action}`);
    } catch (e) {
      this.logger.error(`PgBroker: publish failed: ${e}`);
      throw e;
    }
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel: string): Promise<void> {
    this.validateChannel(channel);
    await this.ensureConnected();

    if (this.subscriptions.has(channel)) {
      return;
    }

    try {
      await this.client!.query(`LISTEN ${channel}`);
      this.subscriptions.add(channel);
      this.messageQueue.set(channel, []);
      this.logger.debug(`PgBroker: subscribed to ${channel}`);
    } catch (e) {
      this.logger.error(`PgBroker: subscribe failed: ${e}`);
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
   * Close PostgreSQL connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this.connected = false;
    }
    this.logger.debug("PostgreSQL connection closed");
  }
}
