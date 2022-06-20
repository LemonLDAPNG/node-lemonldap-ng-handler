export type LDAP_Args = {
  ldapServer: string
  ldapConfBase: string
  ldapBindDN: string
  ldapBindPassword: string
  ldapObjectClass: string | undefined
  ldapAttributeId: string | undefined
  ldapAttributeContent: string | undefined
  ldapCAFile: string | undefined
}

import ldapjs from 'ldapjs'
import { LLNG_Conf, Conf_Accessor } from '@LLNG/types'
import {
  SearchCallbackResponse,
  SearchEntry,
  SearchOptions,
  Client as LDAPClient
} from 'ldapjs'
import fs from 'fs'

const requiredArgs = [
  'ldapServer',
  'ldapConfBase',
  'ldapBindDN',
  'ldapBindPassword'
]

class LDAPConf implements Conf_Accessor {
  /* properties */
  ldapServer: string
  base: string
  dn: string
  pwd: string
  objClass: string
  idAttr: string
  contentAttr: string
  caConf: { ca: string[] } | undefined
  client: LDAPClient
  ldapCa: string

  constructor (args: LDAP_Args) {
    // Check for required args
    requiredArgs.forEach(v => {
      // @ts-ignore
      if (!args[v]) throw new Error(`argument ${v} is required`)
    })
    this.ldapServer = args.ldapServer.match(/^ldap/)
      ? args.ldapServer
      : `ldap://${args.ldapServer}`
    this.base = args.ldapConfBase
    this.dn = args.ldapBindDN
    this.pwd = args.ldapBindPassword
    this.objClass = args.ldapObjectClass || 'applicationProcess'
    this.idAttr = args.ldapAttributeId || 'cn'
    this.contentAttr = args.ldapAttributeContent || 'description'
    this.ldapCa = args.ldapServer.match(/^ldaps/) ? args.ldapCAFile || '' : ''
    if (this.ldapCa !== '') {
      try {
        this.caConf = {
          ca: [fs.readFileSync(this.ldapCa).toString()]
        }
      } catch (error) {
        throw new Error(`Unable to parse ${this.ldapCa}: ${error}`)
      }
    }
    this.client = ldapjs.createClient({
      tlsOptions: this.caConf,
      url: this.ldapServer
    })
  }

  available () {
    return new Promise<number[]>((resolve, reject) => {
      this.client.bind(this.dn, this.pwd, err => {
        if (err) return reject(`LDAP bind failed: ${err}`)
        const data: number[] = []
        const opt: SearchOptions = {
          filter: `(objectClass=${this.objClass})`,
          scope: 'sub',
          attributes: [this.idAttr]
        }
        this.client.search(
          this.base,
          opt,
          (err: Error | null, res: SearchCallbackResponse) => {
            res.on('searchEntry', (entry: SearchEntry) => {
              let val = entry.object[this.idAttr]
              if (typeof val === 'object') val = val[0]
              data.push(parseInt(val.replace(/lmConf-/, ''), 10))
            })
            res.on('error', (err: Error) => {
              return reject(`LDAP search failed: ${err}`)
            })
            res.on('end', () => {
              resolve(data.sort())
            })
          }
        )
      })
    })
  }

  lastCfg () {
    return new Promise<number>((resolve, reject) => {
      this.available()
        .then((av: number[]) => {
          if (av.length > 0) {
            // @ts-ignore
            resolve(av.pop())
          } else {
            reject('No configuration available')
          }
        })
        .catch(err => reject(err))
    })
  }

  load (cfgNum: number, fields: string[] = []) {
    return new Promise<LLNG_Conf>((resolve, reject) => {
      this.client.bind(this.dn, this.pwd, err => {
        if (err) return reject(`LDAP bind failed: ${err}`)
        const opt: SearchOptions = {
          filter: `(objectClass=${this.objClass})`,
          scope: 'sub'
        }
        this.client.search(
          `${this.idAttr}=lmConf-${cfgNum},${this.base}`,
          opt,
          (err: Error | null, res: SearchCallbackResponse) => {
            if (err) return reject(`LDAP search failed: ${err}`)
            let data: string[]
            // @ts-ignore: cfgNum initialized later
            const conf: LLNG_Conf = {}
            res.on('searchEntry', (entry: SearchEntry) => {
              let tmp = entry.object[this.contentAttr]
              data = typeof tmp === 'object' ? tmp : [tmp]
            })
            res.on('error', err => reject(`LDAP search failed: ${err}`))
            res.on('end', result => {
              data.forEach((confLine: string) => {
                if (!confLine.match(/^\{(.*?)\}(.*)/)) {
                  return reject(`Bad conf line: ${confLine}`)
                }
                let k = RegExp.$1
                let v = RegExp.$2
                if (v.match !== null && v.match(/^{/)) {
                  conf[k] = JSON.parse(v)
                } else {
                  conf[k] = v
                }
              })
              return resolve(conf)
            })
          }
        )
      })
    })
  }

  store (conf: LLNG_Conf) {
    return new Promise<boolean>((resolve, reject) => {
      reject('TODO')
    })
  }
}

export default LDAPConf
