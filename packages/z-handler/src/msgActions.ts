/**
 * Message Broker Actions for LemonLDAP::NG handler
 * Port of Lemonldap::NG::Handler::Main::Msg
 *
 * Handles event messages from the message broker (config reload, session purge, etc.)
 */

import type { BrokerMessage } from "@lemonldap-ng/message-broker";
import type { LLNG_Logger } from "@lemonldap-ng/types";

/**
 * Handler interface that msgActions can call back to
 */
export interface MsgActionHandler {
  reload(): Promise<boolean>;
  localUnlog(sessionId?: string): Promise<void>;
  userLogger: LLNG_Logger;
}

/**
 * Process a message from the broker
 * @param handler - Handler instance to call actions on
 * @param msg - Message from broker
 * @returns true if message was processed, false if unknown action
 */
export async function processMessage(
  handler: MsgActionHandler,
  msg: BrokerMessage
): Promise<boolean> {
  const logger = handler.userLogger;

  switch (msg.action) {
    case "reload":
      logger.debug("Message broker: reload configuration requested");
      try {
        await handler.reload();
        logger.info("Configuration reloaded via message broker");
        return true;
      } catch (e) {
        logger.error(`Failed to reload configuration: ${e}`);
        return false;
      }

    case "unlog":
      if (msg.id) {
        logger.debug(`Message broker: unlog session ${msg.id}`);
        await handler.localUnlog(msg.id);
        return true;
      } else {
        logger.warn("Message broker: unlog without session id");
        return false;
      }

    case "newSession":
      // New session notification - currently no action needed for handler
      // This is mainly used by portals to notify other instances
      logger.debug(`Message broker: new session notification (id: ${msg.id})`);
      return true;

    case "delSession":
      // Session deleted - clear from cache
      if (msg.id) {
        logger.debug(`Message broker: session ${msg.id} deleted`);
        await handler.localUnlog(msg.id);
        return true;
      }
      return false;

    case "ping":
      // Ping message for health checks
      logger.debug("Message broker: ping received");
      return true;

    default:
      logger.debug(`Message broker: unknown action '${msg.action}'`);
      return false;
  }
}

/**
 * Message actions that can be published by the handler
 */
export const MsgActions = {
  RELOAD: "reload",
  UNLOG: "unlog",
  NEW_SESSION: "newSession",
  DEL_SESSION: "delSession",
  PING: "ping",
} as const;

export type MsgActionType = (typeof MsgActions)[keyof typeof MsgActions];
