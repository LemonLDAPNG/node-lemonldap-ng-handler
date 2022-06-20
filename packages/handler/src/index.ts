import express from 'express';
import http from 'http';
import {Handler_Args} from './init';
import LemonldapNGHandler, {FastCGI_Opts} from './handlerMain';
import LemonldapNGHandlerDevOps from './handlerDevOps';

let currentHandler: LemonldapNGHandler;
let currentClass: typeof LemonldapNGHandler | typeof LemonldapNGHandlerDevOps;

let knownHandlers = {
  Main: LemonldapNGHandler,
  DevOps: LemonldapNGHandlerDevOps,
};

export const init = ( args: Handler_Args ) => {
  return new Promise<LemonldapNGHandler>( (resolve, reject) => {
    if (!args.type) args.type = 'Main';
    // @ts-ignore: args.type is defined now
    if (knownHandlers[args.type]) {
      // @ts-ignore
      currentClass = knownHandlers[<string>args.type];
      // @ts-ignore
      currentHandler = new knownHandlers[<string>args.type](args);
      currentHandler.init()
        .then( () => resolve(currentHandler) )
        .catch( e => reject(e) );
    } else {
      import('@LLNG/handler-' + args.type.toLowerCase()).then( mod => {
        currentClass = mod;
        currentHandler = new mod.default(args)
        currentHandler.init()
          .then( () => resolve(currentHandler) );
      }).catch( e => reject(e) );
    }
  });
};

export const run = (
  req: express.Request | http.IncomingMessage,
  res: http.ServerResponse,
  next: Function
) => {
  return currentHandler.run(req, res, next);
};

export const nginxServer = ( args: FastCGI_Opts ) => {
  currentHandler.nginxServer(args);
};

export {currentClass as class};