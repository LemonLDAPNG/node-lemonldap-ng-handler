import Crypto from '@LLNG/crypto';
import { LLNG_Conf } from '@LLNG/types';
import vm from 'vm';
import {Iconv} from 'iconv';
import express from 'express';
import http from 'http';
import ipaddrJs from 'ipaddr.js';

class ExtdFunc {
  cipher: Crypto;

  constructor(cipher: Crypto) {
    this.cipher = cipher;
  }

  hostname(req: express.Request): string | undefined {
    return req.headers.host;
  }

  remote_ip(req: express.Request | http.IncomingMessage): string {
    // @ts-ignore: node-fastcgi has no typescript declarations
    return req.ip ? req.ip : req.cgiParams.REMOTE_ADDR;
  }

  unicode2iso(s: string) {
    return new Iconv('UTF-8', 'ISO-8859-1').convert(s);
  }

  iso2unicode(s: string) {
    return new Iconv('ISO-8859-1', 'UTF-8').convert(s);
  }

  basic(login: string, pwd: string) {
    return 'Basic ' + this.unicode2iso(`${login}:${pwd}`).toString('base64')
  }

  groupMatch(groups: {[k: string]: { [k: string]: string | string[] } }, attr: string, value: string) {
    let match = new RegExp(value).test;
    Object.keys(groups).forEach(k => {
      if ( groups[k][attr]) {
        if ( typeof groups[k][attr] === 'string' ) {
          if ( match(<string>groups[k][attr]) ) return true;
        } else {
          (<string[]>groups[k][attr]).forEach( val => {
            if ( match(val) ) return true;
          });
        }
      }
      return false;
    });
  }

  isInNet6(ip: string, net: string) {
    net = net.replace(/^(.*)\/(.*)/, "$1");
    let bits = parseInt(RegExp.$2);
    return ipaddrJs.parse(ip).match(ipaddrJs.parse(net), bits);
  }

  checkLogonHours(logonHours: string, syntax: string = 'hexadecimal', timeCorrection: string, defaultAccess: number =0) {
    let tc = parseInt(timeCorrection);
    let d = new Date();
    let hourPos = d.getDay() * 24 + d.getHours() + tc;
    let div = syntax === 'octetstring' ? 3 : 4;
    let pos = Math.trunc( hourPos/div );
    let v1 = Math.pow( 2, hourPos % div );
    let v2 = logonHours.substr(pos,1);
    let v3: number;
    if (/\d/.test(v2)) {
      v3 = parseInt(v2);
    } else {
      v3 = v2.charCodeAt(0);
      v3 = v3 > 70 ? v3 - 87 : v3 - 55;
    return v1 & v3;
    }
  }

  date(): string {
    let d = new Date();
    let s = '';
    let a = [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
    a.forEach( x => {
      s += x < 10 ? `0${x}` : x;
    });
    return s;
  }

  checkDate( start: number = 0, end: number, defaultAccess: boolean = false ) {
    const conv = (n: number): string => (typeof n === 'string' ? n : n.toString() ).substring(0,14);
    let s = conv(start);
    let e = conv(end);
    if ( !s && !e) return defaultAccess;
    end || (end = 999999999999999);
    let d = this.date();
    return (d >= s && d <= e)
  }

  encrypt(s: string) {
    return this.cipher.encrypt(s)
  }

  token(...args: string[]) {
    let time = Math.trunc(Date.now() / 1000); // Perl time
    let ar = Array.from(args);
    return this.encrypt(`${time}:${ar.join(':')}`);
  }

  encode_base64(s: string) {
    return Buffer.from(s).toString('base64');
  }
}

class SafeLib extends ExtdFunc {
  constructor(conf: LLNG_Conf) {
    if (conf.cipher === undefined)
      throw new Error('a @LLNG/cripto object is required');
    super(conf.cipher);
    vm.createContext(this)
  }
}

export default SafeLib;
