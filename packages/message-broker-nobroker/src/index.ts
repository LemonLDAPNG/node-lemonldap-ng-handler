/**
 * NoBroker - No-op message broker for single instance mode
 * Port of Lemonldap::NG::Common::MessageBroker::NoBroker
 *
 * This implementation doesn't actually broker messages.
 * It's used when running in single-instance mode where
 * no distributed configuration reload is needed.
 */

import type {
  MessageBroker,
  BrokerMessage,
  MessageBrokerOptions,
  LLNG_Logger,
} from "@lemonldap-ng/message-broker";

export default class NoBroker implements MessageBroker {
  private logger: LLNG_Logger;
  private subscriptions: Set<string>;

  constructor(_conf: MessageBrokerOptions, logger: LLNG_Logger) {
    this.logger = logger;
    this.subscriptions = new Set();
    this.logger.debug("NoBroker initialized (single instance mode)");
  }

  /**
   * Publish a message (no-op in single instance mode)
   * @param channel - Channel name
   * @param msg - Message to publish
   */
  async publish(channel: string, msg: BrokerMessage): Promise<void> {
    this.logger.debug(
      `NoBroker: publish to ${channel} ignored (action: ${msg.action})`,
    );
  }

  /**
   * Subscribe to a channel (tracked but no-op)
   * @param channel - Channel name
   */
  async subscribe(channel: string): Promise<void> {
    this.subscriptions.add(channel);
    this.logger.debug(`NoBroker: subscribed to ${channel} (no-op)`);
  }

  /**
   * Get next message (always returns undefined)
   * @param _channel - Channel name
   * @param _delay - Optional delay (ignored)
   */
  async getNextMessage(
    _channel: string,
    _delay?: number,
  ): Promise<BrokerMessage | undefined> {
    return undefined;
  }

  /**
   * Wait for next message (never resolves in single instance mode)
   * This method should not be called in practice with NoBroker
   * @param channel - Channel name
   */
  waitForNextMessage(channel: string): Promise<BrokerMessage> {
    this.logger.warn(
      `NoBroker: waitForNextMessage called for ${channel} - this will never resolve`,
    );
    return new Promise(() => {
      // Never resolves - NoBroker doesn't receive messages
    });
  }

  /**
   * Check if subscribed to a channel
   * @param channel - Channel name
   */
  isSubscribed(channel: string): boolean {
    return this.subscriptions.has(channel);
  }
}
