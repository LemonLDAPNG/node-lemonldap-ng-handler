/**
 * Message Broker interface for LemonLDAP::NG handler
 * Port of Lemonldap::NG::Common::MessageBroker
 */

import type { LLNG_Logger } from "@lemonldap-ng/types";

/**
 * Message structure for broker communication
 */
export interface BrokerMessage {
  action: string;
  channel?: string;
  id?: string;
  [key: string]: any;
}

/**
 * Message Broker interface - mirrors Perl implementation
 */
export interface MessageBroker {
  /**
   * Publish a message to a channel
   * @param channel - Channel name to publish to
   * @param msg - Message to publish
   */
  publish(_channel: string, _msg: BrokerMessage): Promise<void>;

  /**
   * Subscribe to a channel
   * @param channel - Channel name to subscribe to
   */
  subscribe(_channel: string): Promise<void>;

  /**
   * Get next message from channel (non-blocking)
   * @param channel - Channel name to get message from
   * @param delay - Optional delay in seconds to wait
   * @returns Message or undefined if none available
   */
  getNextMessage(
    _channel: string,
    _delay?: number,
  ): Promise<BrokerMessage | undefined>;

  /**
   * Wait for next message from channel (blocking)
   * @param channel - Channel name to wait for message from
   * @returns Message when available
   */
  waitForNextMessage(_channel: string): Promise<BrokerMessage>;
}

/**
 * Configuration options for message broker
 * Compatible with LemonLDAP::NG Perl configuration
 */
export interface MessageBrokerOptions {
  // Common options
  server?: string;
  token?: string;
  reconnect?: number;
  every?: number;
  checkTime?: number;
  eventQueueName?: string;
  statusQueueName?: string;

  // DBI options (PostgreSQL)
  dbiChain?: string;
  dbiUser?: string;
  dbiPassword?: string;

  // Redis Sentinel options
  sentinels?: string[] | Array<{ host: string; port: number }>;
  service?: string; // Perl name for sentinel master
  name?: string; // ioredis name for sentinel master

  // Allow any additional options for backend-specific config
  [key: string]: any;
}

/**
 * Constructor type for MessageBroker implementations
 */
export interface MessageBrokerConstructor {
  new (_conf: MessageBrokerOptions, _logger: LLNG_Logger): MessageBroker;
}

/**
 * Common constants for message broker implementations
 */
export const WAIT_POLL_INTERVAL_MS = 100;

/**
 * Re-export types from @lemonldap-ng/types for convenience
 */
export type { LLNG_Logger };
