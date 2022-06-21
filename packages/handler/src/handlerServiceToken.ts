import express from 'express'
import http from 'http'
import LemonldapNGHandler from './handlerMain'

class LemonldapNGHandlerServiceToken extends LemonldapNGHandler {
  fetchId (req: express.Request | http.IncomingMessage): string {
    // @ts-ignore: node-fastcgi has no ts declarations
    const token = req.cgiParams
      ? // @ts-ignore: node-fastcgi has no ts declarations
        req.cgiParams.HTTP_X_LLNG_TOKEN
      : req.headers['x-llng-token']

    if (token) {
      // Decrypt token
      // Format: encrypt(time:_session_id:vhost1:vhost2,...)
      const tokenElement = this.tsv.cipher.decrypt(token).split(':')

      // At least one vhost is required
      if (!tokenElement[2]) {
        console.warn('Bad service token')
        return ''
      }

      // Is token in good interval ? [ now - 30s, now ]
      const now = Date.now() / 1000
      const tokenTime = parseInt(tokenElement[0])
      if (tokenTime < now - 30 || tokenTime > now) {
        console.warn('Expired service token')
        return ''
      }

      // Is vhost listed in token ?
      const vhost = this.resolveAlias(req)
      if (tokenElement.indexOf(vhost) < 2) {
        console.warn(`${vhost} not authorizated in token`)
        return ''
      }

      // Then use token sessionId
      return tokenElement[1]
    }
    return super.fetchId(req)
  }
}

export default LemonldapNGHandlerServiceToken
