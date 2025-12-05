import express from "express";
import http from "http";
import { Handler_Args } from "./init";
import LemonldapNGHandler, { FastCGI_Opts } from "./handlerMain";
import LemonldapNGHandlerDevOps from "./handlerDevOps";
import LemonldapNGHandlerServiceToken from "./handlerServiceToken";
import LemonldapNGHandlerDevOpsST from "./handlerDevOpsST";
import LemonldapNGHandlerOAuth2 from "./handlerOAuth2";
import LemonldapNGHandlerAuthBasic from "./handlerAuthBasic";
import LemonldapNGHandlerCDA from "./handlerCDA";

let currentHandler: LemonldapNGHandler;
let currentClass: typeof LemonldapNGHandler | typeof LemonldapNGHandlerDevOps;

const knownHandlers = {
  Main: LemonldapNGHandler,
  DevOps: LemonldapNGHandlerDevOps,
  ServiceToken: LemonldapNGHandlerServiceToken,
  ServiceTokenST: LemonldapNGHandlerDevOpsST,
  OAuth2: LemonldapNGHandlerOAuth2,
  AuthBasic: LemonldapNGHandlerAuthBasic,
  CDA: LemonldapNGHandlerCDA,
};

export const init = (args: Handler_Args) => {
  return new Promise<LemonldapNGHandler>((resolve, reject) => {
    if (!args.type) args.type = "Main";
    // @ts-ignore: args.type is defined now
    if (knownHandlers[args.type]) {
      // @ts-ignore
      currentClass = knownHandlers[<string>args.type];
      // @ts-ignore
      currentHandler = new knownHandlers[<string>args.type](args);
      currentHandler
        .init()
        .then(() => resolve(currentHandler))
        .catch((e) => reject(e));
    } else {
      import("@lemonldap-ng/handler-" + args.type.toLowerCase())
        .then((mod) => {
          currentClass = mod.default;
          currentHandler = new currentClass(args);
          currentHandler.init().then(() => resolve(currentHandler));
        })
        .catch((e) => reject(e));
    }
  });
};

export const run = (
  req: express.Request | http.IncomingMessage,
  res: http.ServerResponse,
  next: Function,
) => {
  return currentHandler.run(req, res, next);
};

export const nginxServer = (args: FastCGI_Opts) => {
  currentHandler.nginxServer(args);
};

/**
 * Returns the portal URL from LemonLDAP::NG configuration
 * @returns Portal URL string
 */
export const portal = (): string => {
  return currentHandler.portal();
};

/**
 * Shutdown the handler (stops event loop and cleanup)
 * Call this in tests' afterAll to prevent Jest from hanging
 */
export const shutdown = async () => {
  if (currentHandler) {
    await currentHandler.stopEventLoop();
  }
};

export { currentClass as class };
