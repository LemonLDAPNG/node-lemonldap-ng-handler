import express from 'express';
import http from 'http';
import {Handler_Args} from './init';
import LemonldapNGHandler, {FastCGI_Opts} from './handler-main';

let currentHandler: LemonldapNGHandler;
let currentClass = LemonldapNGHandler;

export const init = ( args: Handler_Args ) => {
  return new Promise<LemonldapNGHandler>( (resolve, reject) => {
    if (args.type) {
      import('@LLNG/handler-' + args.type.toLowerCase()).then( mod => {
        currentClass = mod;
        currentHandler = new mod.default(args)
        currentHandler.init()
          .then( () => resolve(currentHandler) );
      }).catch( e => reject(e) );
    }
    else {
      currentHandler = new LemonldapNGHandler(args);
      currentHandler.init()
        .then( () => resolve(currentHandler) )
        .catch( e => reject(e) );
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
