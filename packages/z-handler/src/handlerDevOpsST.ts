import { Request } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { IncomingMessage } from "http";
import { ParsedQs } from "qs";
import LemonldapNGHandlerDevOps from "./handlerDevOps";
import LemonldapNGHandlerServiceToken from "./handlerServiceToken";

class LemonldapNGHandlerDevOpsST extends LemonldapNGHandlerDevOps {
  fetchId(
    req:
      | Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>
      | IncomingMessage,
  ): string {
    return LemonldapNGHandlerServiceToken.prototype.fetchId.call(this, req);
  }
}

export default LemonldapNGHandlerDevOpsST;
