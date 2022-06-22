import { LLNG_Session } from '@LLNG/types'
import HandlerInit from './init'
import express from 'express'
import http from 'http'
import normalizeUrl from 'normalize-url'

export type FastCGI_Opts = {
  mode: string | undefined
  port: number | undefined
  ip: string | undefined
}

class LemonldapNGHandler extends HandlerInit {
  init () {
    return this.reload()
  }

  /**
   * run(), the access control function
   */
  run (
    req: express.Request | http.IncomingMessage,
    res: http.ServerResponse,
    next: Function
  ) {
    const vhost = req.headers.host
    if (vhost === undefined) {
      this.userLogger.error('Request without Host header')
      this.setError(res, '/', 400, 'Bad request')
      return
    }

    /* 1 - get data */
    const uri = new URL(normalizeUrl(vhost + req.url)).pathname || '/'

    /* 2 - check for maintenance mode */
    if (this.tsv.maintenance[vhost])
      return this.setError(res, '/', 503, 'Service Temporarily Unavailable')

    /* 3 - check if current URI is protected */
    const protection = this.isUnprotected(req, uri)
    if (protection === 2) return next()

    /* 4 - search for LLNG cookie */
    const id = this.fetchId(req)
    if (id !== '') {
      this.retrieveSession(id)
        .then(session => {
          const user = session[this.tsv.whatToTrace]
          this.userLogger.debug(`User ${user} identified`)
          this.grant(req, <string>uri, session)
            .then(grantResult => {
              if (grantResult) {
                this.sendHeaders(req, session)
                this.hideCookie(req)
                next()
                this.userLogger.info(`${vhost}: user ${user} was granted access to ${uri}`)
              } else {
                this.forbidden(req, res, session)
                this.userLogger.notice(`${vhost}: user ${user} was denied access to ${uri}`)
              }
            })
            .catch(e => {
              console.error(e)
              this.setError(res, '/', 500, 'Server error')
            })
        })
        .catch(e => {
          /* Expired session */
          this.goToPortal(res, this.selfUri(<string>vhost, <string>uri))
        })
    } else {
      this.goToPortal(res, this.selfUri(<string>vhost, <string>uri))
    }
  }

  selfUri (vhost: string, uri: string) {
    return (
      (this.tsv.https && this.tsv.https[vhost] ? 'https' : 'http') +
      '://' +
      vhost +
      uri
    )
  }

  nginxServer (fcgiOpt: FastCGI_Opts) {
    fcgiOpt.mode || (fcgiOpt.mode = 'fcgi')
    fcgiOpt.port || (fcgiOpt.port = 9090)
    fcgiOpt.ip || (fcgiOpt.ip = 'localhost')

    const srv: typeof http =
      fcgiOpt.mode === 'fcgi' ? require('node-fastcgi') : http
    srv
      .createServer((req, res) => {
        const next = () => {
          res.writeHead(200, req.headers)
        }
        this.run(req, res, next)
      })
      .listen(fcgiOpt.port, fcgiOpt.ip)
  }

  setError (res: http.ServerResponse, uri: string, code: number, txt: string) {
    if (this.tsv.useRedirectOnError) {
      const url = this.tsv.portal() + `?lmError=${code.toString()}&url=`
      //+ (new Buffer.from(encodeURI(uri))).toString('base64');
      // @ts-ignore: res.redirect may exist
      if (res.redirect) {
        // @ts-ignore: res.redirect may exist
        res.redirect(url)
      } else {
        res.writeHead(401, { Location: url })
      }
    } else {
      // @ts-ignore: res.redirect may exist
      if (res.redirect) {
        // @ts-ignore: res.status may exist
        res.status(code).send(txt)
      } else {
        res.writeHead(code, txt)
      }
    }
  }

  isUnprotected (req: express.Request | http.IncomingMessage, uri: string) {
    const vhost = this.resolveAlias(req)
    if (!this.tsv.defaultCondition[vhost]) return false
    for (let i = 0; i < this.tsv.locationRegexp[vhost].length; i++) {
      if (this.tsv.locationRegexp[vhost][i].test(uri))
        return this.tsv.locationProtection[vhost][i]
    }
    return this.tsv.defaultProtection[vhost]
  }

  resolveAlias (req: express.Request | http.IncomingMessage) {
    // @ts-ignore: req.headers.host has already been tested
    const vhost = req.headers.host.replace(/:.*$/, '')
    return this.tsv.vhostAlias[vhost] || vhost
  }

  fetchId (req: express.Request | http.IncomingMessage) {
    if (req.headers.cookie) {
      const res = this.tsv.cookieDetect.exec(req.headers.cookie)
      if (res && res[1] != '0') return res[1]
    }
    return ''
  }

  retrieveSession (id: string) {
    return new Promise<LLNG_Session>((resolve, reject) => {
      if (this.sessionAcc === undefined)
        return reject('Server not ready, please wait')
      this.sessionAcc
        .get(id)
        .then((session: LLNG_Session) => {
          const now = (Date.now() / 1000) | 0
          if (
            now - session._utime > this.tsv.timeout ||
            (this.tsv.timeoutActivity &&
              session._lastSeen &&
              // @ts-ignore: session._lastSeen is defined
              now - session._lastSeen > this.tsv.timeoutActivity)
          ) {
            reject(`Session ${id} expired`)
          } else {
            if (
              this.tsv.timeoutActivity &&
              // @ts-ignore: session._lastSeen is defined
              now - session._lastSeen > 60
            ) {
              session._lastSeen = now
              // @ts-ignore this.sessionAcc is defined here
              this.sessionAcc.update(session)
            }
            resolve(session)
          }
        })
        .catch((e: string) => {
          reject(`Session ${id} can't be found in store: ${e}`)
        })
    })
  }

  grant (
    req: express.Request | http.IncomingMessage,
    uri: string,
    session: LLNG_Session
  ) {
    return new Promise<boolean>((resolve, reject) => {
      const vhost = this.resolveAlias(req)
      if (!this.tsv.defaultCondition[vhost]) {
        return reject(
          `No configuration found for ${vhost} (or not listed in Node.js virtualHosts)`
        )
      }
      if (this.tsv.locationRegexp[vhost]) {
        let i = 0
        this.tsv.locationRegexp[vhost].forEach((regex: RegExp) => {
          if (regex.test(uri))
            return resolve(this.tsv.locationCondition[vhost][i](req, session))
          i++
        })
      }
      this.tsv.defaultCondition[vhost](req, session)
        ? resolve(true)
        : reject('Unauthorized')
    })
  }

  sendHeaders (
    req: express.Request | http.IncomingMessage,
    session: LLNG_Session
  ) {
    const vhost = this.resolveAlias(req)
    try {
      let i = 0
      // @ts-ignore
      req.headers['Lm-Remote-User'] = session[this.tsv.whatToTrace]
      const map = this.tsv.forgeHeaders[vhost](session)
      Object.keys(map).forEach((k: string) => {
        i++
        req.headers[k] = map[k]
        req.rawHeaders.push(k, map[k])

        // req.redirect is defined when running under express. If not
        // we are running as FastCGI server
        // @ts-ignore
        if (!req.redirect) {
          req.headers[`Headername${i}`] = k
          req.headers[`Headervalue${i}`] = map[k]
        }
      })
    } catch (e) {
      console.error(`Headers maybe not sent: ${e}`)
      return
    }
  }

  hideCookie (req: express.Request | http.IncomingMessage) {
    if (req.headers.cookie)
      req.headers.cookie = req.headers.cookie.replace(this.tsv.cookieDetect, '')
  }

  forbidden (
    req: express.Request | http.IncomingMessage,
    res: http.ServerResponse,
    session: LLNG_Session
  ) {
    if (session._logout) {
      this.goToPortal(res, session._logout, 'logout=1')
    } else {
      this.setError(res, '/', 403, 'Forbidden')
    }
  }

  goToPortal (res: http.ServerResponse, uri: string, args: string = '') {
    if (typeof this.tsv.portal !== 'function') {
      this.setError(res, uri, 503, 'Waiting for configuration')
      return
    }
    const urlc =
      this.tsv.portal() +
      (uri
        ? // @ts-ignore
          '?url=' + new Buffer.from(encodeURI(uri)).toString('base64')
        : '') +
      (args ? (uri ? '&' : '?') + args : '')

    // req.redirect is defined when running under express. If not
    // we are running as FastCGI server
    // @ts-ignore
    if (res.redirect) {
      // @ts-ignore
      res.redirect(urlc)
    } else {
      // Nginx doesn't accept 302 from a auth request. LLNG Nginx configuration
      // maps 401 to 302 when "Location" is set
      res.writeHead(401, { Location: urlc })
    }
  }
}

export default LemonldapNGHandler
