/**
 * HTTP/Web Message Broker for LemonLDAP::NG handler
 * Port of Lemonldap::NG::Common::MessageBroker::Web
 *
 * Uses HTTP polling to communicate with the LemonLDAP::NG portal
 * for receiving events and configuration updates.
 */

import {
  WAIT_POLL_INTERVAL_MS,
  type MessageBroker,
  type BrokerMessage,
  type MessageBrokerOptions,
  type LLNG_Logger,
} from "@lemonldap-ng/message-broker";

export default class WebBroker implements MessageBroker {
  private logger: LLNG_Logger;
  private serverUrl: string;
  private token: string;
  private pollInterval: number;
  private messageQueue: Map<string, BrokerMessage[]> = new Map();
  private subscriptions: Set<string> = new Set();
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(conf: MessageBrokerOptions, logger: LLNG_Logger) {
    this.logger = logger;
    this.serverUrl = conf.server || "";
    this.token = conf.token || "";
    this.pollInterval = (conf.every || 5) * 1000; // Default 5 seconds

    if (!this.serverUrl) {
      this.logger.warn(
        "WebBroker: no server URL configured, broker will be inactive",
      );
    } else {
      this.logger.debug(`WebBroker initialized with server: ${this.serverUrl}`);
    }
  }

  /**
   * Start polling for messages
   */
  private startPolling(): void {
    if (this.pollTimer || !this.serverUrl) {
      return;
    }

    this.pollTimer = setInterval(async () => {
      await this.poll();
    }, this.pollInterval);

    this.logger.debug(
      `WebBroker: started polling every ${this.pollInterval}ms`,
    );
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.logger.debug("WebBroker: stopped polling");
    }
  }

  /**
   * Poll the server for new messages
   */
  private async poll(): Promise<void> {
    if (!this.serverUrl) {
      return;
    }

    for (const channel of this.subscriptions) {
      try {
        const url = `${this.serverUrl}/events/${encodeURIComponent(channel)}`;
        const headers: Record<string, string> = {
          Accept: "application/json",
        };

        if (this.token) {
          headers["Authorization"] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
          method: "GET",
          headers,
        });

        if (response.ok) {
          const data = (await response.json()) as
            | BrokerMessage
            | BrokerMessage[];

          if (Array.isArray(data)) {
            for (const msg of data) {
              this.queueMessage(channel, msg);
            }
          } else if (data && data.action) {
            this.queueMessage(channel, data);
          }
        } else if (response.status !== 204) {
          // 204 = no new messages
          this.logger.warn(
            `WebBroker: poll failed for ${channel}: ${response.status}`,
          );
        }
      } catch (e) {
        this.logger.error(`WebBroker: poll error for ${channel}: ${e}`);
      }
    }
  }

  /**
   * Queue a message for processing
   */
  private queueMessage(channel: string, msg: BrokerMessage): void {
    if (!this.messageQueue.has(channel)) {
      this.messageQueue.set(channel, []);
    }
    this.messageQueue.get(channel)!.push(msg);
    this.logger.debug(`WebBroker: queued message on ${channel}: ${msg.action}`);
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, msg: BrokerMessage): Promise<void> {
    if (!this.serverUrl) {
      this.logger.debug("WebBroker: publish skipped (no server configured)");
      return;
    }

    try {
      const url = `${this.serverUrl}/events/${encodeURIComponent(channel)}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.token) {
        headers["Authorization"] = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(msg),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.logger.debug(`WebBroker: published to ${channel}: ${msg.action}`);
    } catch (e) {
      this.logger.error(`WebBroker: publish failed: ${e}`);
      throw e;
    }
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(channel: string): Promise<void> {
    if (this.subscriptions.has(channel)) {
      return;
    }

    this.subscriptions.add(channel);
    this.messageQueue.set(channel, []);
    this.logger.debug(`WebBroker: subscribed to ${channel}`);

    // Start polling if we have subscriptions
    if (this.subscriptions.size === 1) {
      this.startPolling();
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
   * Close broker and stop polling
   */
  close(): void {
    this.stopPolling();
    this.subscriptions.clear();
    this.messageQueue.clear();
    this.logger.debug("WebBroker: closed");
  }
}
