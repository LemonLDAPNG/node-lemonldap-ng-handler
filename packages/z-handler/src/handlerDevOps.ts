import { LLNG_Session } from '@lemonldap-ng/types'
import { Handler_Args } from './init'
import LemonldapNGHandler from './handlerMain'
import RE2 from 're2'
import express from 'express'
import http from 'http'
import SafeLib from '@lemonldap-ng/safelib'
import vm from 'vm'

type Vhost_Config = {
  prot: string
  host: string
  path: string
  port: string
  headers?: { [k: string]: string }
  lb?: boolean
}

class LemonldapNGHandlerDevOps extends LemonldapNGHandler {
  constructor (args: Handler_Args) {
    super(args)
    this.tsv.lastVhostUpdate = {}
  }

  grant (
    req: express.Request | http.IncomingMessage,
    uri: string,
    session: LLNG_Session
  ) {
    const vhost = this.resolveAlias(req)
    if (
      this.tsv.defaultCondition[vhost] &&
      Date.now() / 1000 - this.tsv.lastVhostUpdate[vhost] < 600
    ) {
      // @ts-ignore
      return <Promise<boolean>>super.grant(req, uri, session)
    }
    const base =
      // @ts-ignore: cgiParams is tested
      req.cgiParams && req.cgiParams.RULES_URL
        ? // @ts-ignore: same
          req.cgiParams.RULES_URL
        : (this.tsv.loopBackUrl || 'http://127.0.0.1') + '/rules.json'
    if (!/^(https?):\/\/([^/:]+)(?::(\d+))?(.*)$/.test(base)) {
      return new Promise<boolean>((resolve, reject) =>
        reject(`Bad loopBackUrl ${base}`)
      )
    }
    const lvOpts: Vhost_Config = {
      prot: RegExp.$1,
      host: RegExp.$2,
      path: RegExp.$4,
      port: RegExp.$3 || (RegExp.$1 == 'https' ? '443' : '80'),
      // @ts-ignore: cgiParams is tested
      lb: !(req.cgiParams && req.cgiParams.RULES_URL)
    }
    return new Promise<boolean>((resolve, reject) => {
      this.loadVhostConfig(req, vhost, lvOpts)
        .then(() => {
          this.grant(req, uri, session)
            .then(res => {
              resolve(res)
            })
            .catch(e => reject(e))
        })
        .catch(err => {
          console.error(err)
          this.grant(req, uri, session)
            .then(res => {
              resolve(res)
            })
            .catch(e => reject(e))
        })
    })
  }

  loadVhostConfig (
    req: express.Request | http.IncomingMessage,
    vhost: string,
    lvOpts: Vhost_Config
  ) {
    return new Promise<boolean>((resolve, reject) => {
      if (!lvOpts.lb) vhost = lvOpts.host
      delete lvOpts.lb
      lvOpts.headers = { Host: vhost }
      const http = require(lvOpts.prot)
      // @ts-ignore, property no more needed but required before
      delete lvOpts.prot
      const req = http.request(lvOpts, (resp: http.ServerResponse) => {
        let str = ''
        resp.on('data', chunk => {
          str += chunk
        })
        resp.on('end', () => {
          // Blank vhost
          this.tsv.locationCondition[vhost] = []
          this.tsv.locationProtection[vhost] = []
          this.tsv.locationRegexp[vhost] = []
          this.tsv.locationCount[vhost] = 0
          this.tsv.headerList[vhost] = []
          if (str === '') {
            this.tsv.defaultCondition[vhost] = () => {
              return true
            }
            this.tsv.defaultProtection[vhost] = 0
            this.tsv.lastVhostUpdate[vhost] = Date.now() / 1000
            return resolve(true)
          }
          try {
            const vhostConfig = JSON.parse(str)
            // @ts-expect-error: TODO
            this.safe[vhost] = new SafeLib({ cipher: this.tsv.cipher })
            if (vhostConfig.rules && typeof vhostConfig.rules === 'object') {
              Object.keys(vhostConfig.rules).forEach((url: string) => {
                const rule = new String(vhostConfig.rules[url]).valueOf()
                const [cond, prot] = this.conditionSub(rule, this.safe[vhost])
                if (url === 'default') {
                  this.tsv.defaultCondition[vhost] = cond
                  this.tsv.defaultProtection[vhost] = prot
                } else {
                  this.tsv.locationCondition[vhost].push(cond)
                  this.tsv.locationProtection[vhost].push(prot)
                  this.tsv.locationRegexp[vhost].push(
                    new RE2(url.replace(/\(\?#.*?\)/, ''))
                  )
                  this.tsv.locationCount[vhost]++
                }
              })
              if (!this.tsv.defaultCondition[vhost]) {
                this.tsv.defaultCondition[vhost] = () => true
                this.tsv.defaultProtection[vhost] = 0
              }
            }
            if (
              vhostConfig.headers &&
              typeof vhostConfig.headers === 'object'
            ) {
              const sub = Object.keys(vhostConfig.headers)
                .map(name => {
                  this.tsv.headerList[vhost].push(name)
                  return `'${name}': ${this.substitute(
                    vhostConfig.headers[name]
                  )}`
                })
                .join(',')
              vm.runInContext(
                `fg = function(session) {return {${sub}}}`,
                this.safe[vhost]
              )
              // @ts-ignore; fg is defined now
              this.tsv.forgeHeaders[vhost] = this.safe[vhost].fg
            }
            this.tsv.lastVhostUpdate[vhost] = Date.now() / 1000
            resolve(true)
          } catch (e) {
            reject('Unable to getremote config: ' + e)
          }
        })
        req.on('error', (e: any) => {
          reject(e)
        })
        req.end()
      })
    })
  }
}

export default LemonldapNGHandlerDevOps
