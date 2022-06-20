import RE2 from 're2';
import Crypto from '@LLNG/crypto';

declare type vhost = string;

export declare type TSV = {
  /* Cookies */
  cookieName: string;
  cookieDetect: RE2;
  cda?: boolean;
  httpOnly?: boolean;
  securedCookie: number;

  /* Session */
  timeout: number;
  timeoutActivity?: number;
  whatToTrace: string;

  /* Error management */
  useRedirectOnError?: boolean;
  useRedirectOnForbidden?: boolean;

  /* */
  cipher: Crypto;
  customFunctions: any; // Unused for now

  /* rules */
  defaultCondition: { [k: vhost]: Function };
  defaultProtection: { [k: vhost]: number };
  locationCondition: { [k: vhost]: Function[] };
  locationCount: { [k: vhost]: number };
  locationProtection: { [k: vhost]: number[] };
  locationRegexp: { [k: vhost]: RE2[] };

  /* headers */
  headerList: { [k: vhost]: string[] };
  forgeHeaders: { [k: vhost]: Function };

  /* vhost options */
  https: { [k: vhost]: boolean };
  maintenance: { [k: vhost]: number | undefined };
  port: { [k: vhost]: number | undefined };
  portal: Function;
  vhostAlias: { [k: vhost]: vhost };

  /* DevOps */
  loopBackUrl: string | undefined;
  lastVhostUpdate: { [k: vhost]: number };
};
