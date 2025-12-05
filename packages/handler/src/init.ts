import Conf from "@lemonldap-ng/conf";
import Session from "@lemonldap-ng/session";
import SafeLib from "@lemonldap-ng/safelib";
import Logger from "@lemonldap-ng/logger";
import {
  LocalConf,
  LLNG_Conf,
  LLNG_Session,
  IniSection_NodeHandler,
  LLNG_Logger,
} from "@lemonldap-ng/types";
import type {
  BrokerMessage,
  MessageBrokerOptions,
} from "@lemonldap-ng/message-broker";
import vm from "vm";
import crypto from "crypto";
import RE2 from "re2";
import { TSV } from "./tsv";
import { processMessage, MsgActionHandler } from "./msgActions";

const condMatch = new RE2("^logout(?:_sso|_app|_app_sso|)(?:s+(.*))?$", "i");

type handlerConf = LocalConf & {
  nodeVhosts?: string;
  [k: string]: any;
};

export type Handler_Args = {
  configStorage?: LocalConf | undefined;
  type?: string | undefined;
  [key: string]: string | number | boolean | object | undefined;
};

let sid = 0;

const requiredFields = [
  "cda",
  "cookieExpiration",
  "cipher",
  "cookieName",
  "customFunctions",
  "httpOnly",
  "securedCookie",
  "timeout",
  "timeoutActivity",
  "useRedirectOnError",
  "useRedirectOnForbidden",
  "whatToTrace",
  "loopBackUrl",
  "handlerInternalCache",
  "authChoiceAuthBasic",
  "authChoiceParam",
];

/**
 * Default message broker options
 */
const DEFAULT_CHECK_TIME = 600; // seconds
const MIN_CHECK_INTERVAL_MS = 1000; // minimum 1 second
const DEFAULT_EVENT_QUEUE = "llng-events";
const DEFAULT_STATUS_QUEUE = "llng-status";

abstract class HandlerInit implements MsgActionHandler {
  confAcc: Conf;
  localConf: handlerConf;
  // @ts-ignore: defined later
  sessionAcc: Session;
  vhostList: string[];
  safe: { [vhost: string]: SafeLib } = {};
  tsv: TSV;
  // @ts-ignore: defined later
  userLogger: LLNG_Logger;

  /* Message Broker properties */
  private eventLoopInterval: ReturnType<typeof setInterval> | null = null;
  private lastConfigCheck: number = 0;

  constructor(args: Handler_Args) {
    // @ts-ignore: some values will be initialized later
    this.tsv = {
      defaultCondition: {},
      defaultProtection: {},
      forgeHeaders: {},
      headerList: {},
      https: {},
      locationCondition: {},
      locationCount: {},
      locationProtection: {},
      locationRegexp: {},
      maintenance: {},
      port: {},
      portal: () => "",
      vhostAlias: {},
      eventQueueName: DEFAULT_EVENT_QUEUE,
      statusQueueName: DEFAULT_STATUS_QUEUE,
      checkMsg: 0,
      checkTime: DEFAULT_CHECK_TIME,
    };
    this.localConf = args;
    if (!args.configStorage) args.configStorage = {};
    args.configStorage.localStorage ||
      (args.configStorage.localStorage = args.localStorage);
    args.configStorage.localStorageOptions ||
      (args.configStorage.localStorageOptions = args.localStorageOptions);
    this.confAcc = new Conf(args.configStorage);
    const handlerConf = this.confAcc.getLocalConf("handler", true);
    const nodeHandlerConf = <IniSection_NodeHandler>(
      this.confAcc.getLocalConf("node-handler", false)
    );
    [handlerConf, nodeHandlerConf].forEach((iniSection) => {
      Object.keys(iniSection).forEach((k: string) => {
        if (!this.localConf) throw new Error("undef");
        if (this.localConf[k] === undefined) this.localConf[k] = iniSection[k];
      });
    });
    if (this.localConf.nodeVhosts === undefined)
      // istanbul ignore next
      throw new Error("No Virtualhosts configured for Node.js");
    this.vhostList = this.localConf.nodeVhosts.split(/[,\s]+/);
  }

  reload() {
    return new Promise<boolean>((resolve, reject) => {
      const ucFirst = (s: string) => {
        return s.charAt(0).toUpperCase() + s.slice(1);
      };
      this.confAcc.ready.then(() => {
        this.confAcc
          .getConf({})
          .then((conf: LLNG_Conf) => {
            requiredFields.forEach((k) => {
              // @ts-ignore: all fields not declared
              this.tsv[k] = conf[k];
            });
            // Compute keyH for AuthBasic session ID generation
            if (conf.key) {
              this.tsv.keyH = crypto
                .createHash("sha256")
                .update(conf.key)
                .digest("hex");
            }
            Object.keys(this.localConf).forEach((k) => {
              conf[k] = this.localConf[k];
            });
            ["https", "port", "maintenance"].forEach((k) => {
              if (conf[k] !== undefined) {
                // @ts-ignore; k is in TSV type
                this.tsv[k] = { _: conf[k] };
                if (conf.vhostOptions) {
                  const name = `vhost${ucFirst(k)}`;
                  Object.keys(conf.vhostOptions).forEach((vhost: string) => {
                    // @ts-ignore: val is a number
                    const val: number = conf.vhostOptions[vhost][name];
                    // @ts-ignore; k is in TSV type
                    if (val > 0) this.tsv[k][vhost] = val;
                  });
                }
              }
            });
            if (!conf.portal) throw new Error("portal should be defined");
            //if ( conf.portal.match(/[\$\(&\|"']/) ) {
            //  this.tsv.portal = self.conditionSubs(conf.portal)[0];
            //} else {
            this.tsv.portal = () => conf.portal;
            //}

            /**
             * Sessions storage initialization
             */

            //['global','oidc'].forEach
            if (!conf["globalStorage"] || !conf["globalStorageOptions"])
              // istanbul ignore next
              throw new Error("Missing session storage configuration");
            try {
              this.sessionAcc = new Session({
                storageModule: conf["globalStorage"],
                storageModuleOptions: conf["globalStorageOptions"],
              });
            } catch (e) {
              // istanbul ignore next
              throw new Error(`Unable to load session module: ${e}`);
            }

            /**
             * Location rules initialization
             */

            Object.keys(conf.locationRules).forEach((vhost: string) => {
              if (this.vhostList.indexOf(vhost) == -1) return;
              this.tsv.locationCount[vhost] = 0;
              [
                "locationRegexp",
                "locationProtection",
                "locationCondition",
              ].forEach((k) => {
                // @ts-ignore: fields declared in TSV type
                if (this.tsv[k][vhost] === undefined) this.tsv[k][vhost] = [];
              });
              if (!this.safe[vhost]) this.safe[vhost] = new SafeLib(conf);

              // @ts-ignore conf.locationRules[vhost] exists
              const rules = conf.locationRules[vhost];
              Object.keys(rules).forEach((url) => {
                const [cond, prot] = this.conditionSub(
                  rules[url],
                  this.safe[vhost],
                );
                if (url === "default") {
                  this.tsv.defaultCondition[vhost] = cond;
                  this.tsv.defaultProtection[vhost] = prot;
                } else {
                  this.tsv.locationCondition[vhost].push(cond);
                  this.tsv.locationProtection[vhost].push(prot);
                  this.tsv.locationRegexp[vhost].push(
                    new RE2(url.replace(/\(\?#.*?\)/, "")),
                  );
                  this.tsv.locationCount[vhost]++;
                }
              });
              if (!this.tsv.defaultCondition[vhost]) {
                // istanbul ignore next
                this.tsv.defaultCondition[vhost] = () => true;
                // istanbul ignore next
                this.tsv.defaultProtection[vhost] = 0;
              }
            });

            /**
             * Headers initialization
             */

            if (conf.exportedHeaders !== undefined) {
              Object.keys(conf.exportedHeaders).forEach((vhost: string) => {
                // @ts-ignore
                const headers = <{ [k: string]: string }>(
                  // @ts-ignore: conf.exportedHeaders[vhost] is defined
                  conf.exportedHeaders[vhost]
                );
                if (this.vhostList.indexOf(vhost) == -1) return;
                if (!this.tsv.headerList[vhost])
                  this.tsv.headerList[vhost] = [];
                let sub = "";
                Object.keys(headers).forEach((name: string) => {
                  this.tsv.headerList[vhost].push(name);
                  sub += `'${name}': ${this.substitute(headers[name])},`;
                });
                sub = sub.replace(/,$/, "");
                vm.runInContext(
                  `fg = function(session) {return {${sub}};}`,
                  this.safe[vhost],
                );
                // @ts-ignore: fg is now defined
                this.tsv.forgeHeaders[vhost] = this.safe[vhost].fg;
              });
            }

            // TODO: post url initialization

            /**
             * Alias initialization
             */
            if (conf.vhostOptions !== undefined) {
              Object.keys(conf.vhostOptions).forEach((vhost: string) => {
                // @ts-ignore: conf.vhostOptions[vhost] is defined
                if (conf.vhostOptions[vhost].aliases) {
                  // @ts-ignore: conf.vhostOptions[vhost] is defined
                  conf.vhostOptions[vhost].aliases.forEach((alias: string) => {
                    this.tsv.vhostAlias[alias] = vhost;
                  });
                }
              });
            }
            this.tsv.cookieDetect = new RE2(
              `\\b${this.tsv.cookieName}=([^;]+)`,
            );
            this.sessionAcc.ready.then(() => {
              Logger(conf, true)
                .then(async (logger) => {
                  this.userLogger = logger;
                  // Initialize message broker after logger is ready
                  const brokerInitialized = await this.msgBrokerInit(conf);
                  if (!brokerInitialized) {
                    this.userLogger.info(
                      "Handler initialized without message broker (real-time events disabled)",
                    );
                  }
                  // Start event loop for checking broker messages
                  this.startEventLoop();
                  resolve(true);
                })
                .catch((e) => {
                  // Logger initialization failed, throw error
                  // istanbul ignore next
                  throw new Error(`Logger error: ${e}`);
                });
            });
          })
          .catch((e: string) => {
            // istanbul ignore next
            reject(`Unable to get configuration: ${e}`);
          });
      });
    });
  }

  conditionSub(cond: string, ctx: SafeLib | undefined): [Function, number] {
    const OK = () => true;
    const NOK = () => false;
    if (cond === "accept") return [OK, 0];
    if (cond === "deny") return [NOK, 0];
    if (cond === "unprotect") return [OK, 1];
    if (cond === "skip") return [OK, 2];

    // TODO: manage app logout
    const res = condMatch.exec(cond);
    if (res && res[1]) {
      const url = res[1];
      if (url) {
        return [
          (session: LLNG_Session) => {
            session._logout = url;
            return false;
          },
          0,
        ];
      } else {
        return [
          (session: LLNG_Session) => {
            session._logout = this.tsv.portal();
            return false;
          },
          0,
        ];
      }
    }
    cond = this.substitute(cond);
    if (ctx) {
      sid++;
      vm.runInContext(
        `sub${sid.toString()} = function(req,session) {return (${cond});}`,
        ctx,
      );
      // @ts-ignore: cts is also a context
      return [ctx[`sub${sid.toString()}`], 0];
    } else {
      // istanbul ignore next
      throw new Error("Disabling safeJail is not supported");
    }
  }

  substitute(expr: string) {
    return (
      expr

        // Special macros
        .replace(/\$date\b/g, "this.date()")
        .replace(/\$vhost\b/g, "this.hostname(req)")
        .replace(/\$ip\b/g, "this.remote_ip(req)")

        // Session attributes: $xx is replaced by session.xx
        .replace(/\$(_*[a-zA-Z]\w*)/g, "session.$1")
    );
  }

  /**
   * Abstract method to be implemented by subclasses
   * Clears local session cache
   */
  abstract localUnlog(sessionId?: string): Promise<void>;

  /**
   * Parse Perl-style message broker module name
   * Handles formats:
   * - "::Redis" -> "redis"
   * - "Lemonldap::NG::Common::MessageBroker::Redis" -> "redis"
   * - "Redis" -> "redis"
   * - "redis" -> "redis"
   */
  private parseBrokerType(brokerType: string): string {
    if (!brokerType) return "nobroker";

    // Extract the last part after ::
    const match = brokerType.match(/::(\w+)$/);
    if (match) {
      return match[1].toLowerCase();
    }

    // Already a simple name
    return brokerType.toLowerCase();
  }

  /**
   * Initialize message broker from configuration
   * @param conf - LemonLDAP::NG configuration
   * @returns true if broker was successfully initialized, false if using fallback/none
   */
  protected async msgBrokerInit(conf: LLNG_Conf): Promise<boolean> {
    // Get message broker configuration
    // Parse Perl-style module name (::Redis, Lemonldap::NG::Common::MessageBroker::Redis)
    const brokerType = this.parseBrokerType(conf.messageBroker || "nobroker");
    const brokerOptions: MessageBrokerOptions = conf.messageBrokerOptions || {};

    // Set queue names from config
    this.tsv.eventQueueName =
      brokerOptions.eventQueueName || DEFAULT_EVENT_QUEUE;
    this.tsv.statusQueueName =
      brokerOptions.statusQueueName || DEFAULT_STATUS_QUEUE;
    this.tsv.checkTime = brokerOptions.checkTime || DEFAULT_CHECK_TIME;

    // Dynamic import of message broker module
    const moduleName = `@lemonldap-ng/message-broker-${brokerType.toLowerCase()}`;
    try {
      const BrokerModule = await import(moduleName);
      const BrokerClass = BrokerModule.default;

      // Create reader and writer instances
      this.tsv.msgBrokerReader = new BrokerClass(
        brokerOptions,
        this.userLogger,
      );
      this.tsv.msgBrokerWriter = new BrokerClass(
        brokerOptions,
        this.userLogger,
      );

      // Subscribe to event queue
      if (this.tsv.msgBrokerReader) {
        await this.tsv.msgBrokerReader.subscribe(this.tsv.eventQueueName);
        this.userLogger.debug(
          `Message broker ${brokerType} initialized, subscribed to ${this.tsv.eventQueueName}`,
        );
        return true;
      }
      return false;
    } catch (e) {
      this.userLogger.warn(
        `Failed to load message broker ${moduleName}: ${e}. Using NoBroker fallback.`,
      );
      // Fallback to NoBroker
      try {
        const NoBroker = (await import("@lemonldap-ng/message-broker-nobroker"))
          .default;
        this.tsv.msgBrokerReader = new NoBroker({}, this.userLogger);
        this.tsv.msgBrokerWriter = new NoBroker({}, this.userLogger);
        return false; // Using fallback, not the configured broker
      } catch {
        // No broker available at all
        this.userLogger.debug("No message broker available");
        return false;
      }
    }
  }

  /**
   * Start the event loop to check for broker messages
   * Uses setInterval for non-blocking periodic checks
   */
  protected startEventLoop(): void {
    if (this.eventLoopInterval) {
      // Already running
      return;
    }

    // Check interval (convert seconds to ms, minimum 1 second)
    const intervalMs = Math.max(
      MIN_CHECK_INTERVAL_MS,
      (this.tsv.checkTime || DEFAULT_CHECK_TIME) * 1000,
    );

    this.eventLoopInterval = setInterval(async () => {
      try {
        await this.checkEvents();
      } catch (e) {
        this.userLogger.error(`Event loop error: ${e}`);
      }
    }, intervalMs);

    this.userLogger.debug(`Event loop started with ${intervalMs}ms interval`);
  }

  /**
   * Stop the event loop and close all connections
   * Called to cleanly shutdown the handler (useful for tests)
   */
  public async stopEventLoop(): Promise<void> {
    if (this.eventLoopInterval) {
      clearInterval(this.eventLoopInterval);
      this.eventLoopInterval = null;
      this.userLogger.debug("Event loop stopped");
    }
    // Close session storage to stop background processes
    if (this.sessionAcc && typeof this.sessionAcc.close === "function") {
      await this.sessionAcc.close();
      this.userLogger.debug("Session storage closed");
    }
  }

  /**
   * Check for pending events from the message broker
   * Called periodically by the event loop
   */
  protected async checkEvents(): Promise<void> {
    if (!this.tsv.msgBrokerReader) {
      return;
    }

    try {
      const msg = await this.tsv.msgBrokerReader.getNextMessage(
        this.tsv.eventQueueName,
        0, // Non-blocking
      );

      if (msg) {
        this.tsv.checkMsg++;
        await processMessage(this, msg);
      }
    } catch (e) {
      this.userLogger.error(`Error checking events: ${e}`);
    }
  }

  /**
   * Publish an event to the message broker
   * @param action - Action type
   * @param data - Additional data to include
   */
  protected async publishEvent(
    action: string,
    data: Record<string, any> = {},
  ): Promise<void> {
    if (!this.tsv.msgBrokerWriter) {
      return;
    }

    const msg: BrokerMessage = {
      action,
      channel: this.tsv.eventQueueName,
      ...data,
    };

    try {
      await this.tsv.msgBrokerWriter.publish(this.tsv.eventQueueName, msg);
      this.userLogger.debug(`Published event: ${action}`);
    } catch (e) {
      this.userLogger.error(`Failed to publish event ${action}: ${e}`);
    }
  }
}

export default HandlerInit;
