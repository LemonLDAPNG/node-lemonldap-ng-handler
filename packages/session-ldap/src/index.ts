import fs from 'fs'
import ldapjs from 'ldapjs'
import { LLNG_Session, Session_Accessor } from '@LLNG/types'
type SessionLDAP_Args = {
  ldapServer: string
  ldapConfBase: string
  ldapBindDN: string | undefined
  ldapBindPassword: string | undefined
  ldapObjectClass: string | undefined
  ldapAttributeId: string | undefined
  ldapAttributeContent: string | undefined
  ldapCAFile: string | undefined
}
import { SearchOptions, Client as LDAPClient } from 'ldapjs'

const defaultValues = {
  ldapObjectClass: 'applicationProcess',
  ldapAttributeId: 'cn',
  ldapAttributeContent: 'description'
}

type CaConf = {
  ca: string[] | undefined
}

class LDAPSession implements Session_Accessor {
  ldap: LDAPClient
  base: string
  class: string
  contentAttr: string
  idAttr: string

  constructor (args: SessionLDAP_Args) {
    ['ldapServer', 'ldapConfBase'].forEach(k => {
      if (!args[<keyof SessionLDAP_Args>k])
        throw new Error(`Missing ${k} argument`)
    })
    const ldapServer = args.ldapServer.match(/^ldap/)
      ? args.ldapServer
      : `ldap://${args.ldapServer}`
    const ldapCa = args.ldapServer.match(/^ldaps/) ? args.ldapCAFile || '' : ''
    Object.keys(defaultValues).forEach(k => {
      // @ts-ignore
      if (!args[k]) args[k] = defaultValues[k]
    })
    this.base = args.ldapConfBase
    // @ts-ignore: args.ldapObjectClass is initialized
    this.class = args.ldapObjectClass
    // @ts-ignore: args.ldapAttributeContent is initialized
    this.contentAttr = args.ldapAttributeContent
    // @ts-ignore: args.ldapAttributeId is initialized
    this.idAttr = args.ldapAttributeId
    const caConf: CaConf = { ca: undefined }
    if (ldapCa != '') {
      caConf.ca = [fs.readFileSync(ldapCa).toString()]
    }
    this.ldap = ldapjs.createClient({
      tlsOptions: caConf,
      url: ldapServer
    })
    this.ldap.bind(args.ldapBindDN || '', args.ldapBindPassword || '', err => {
      if (err) throw new Error(`LDAP bind failed: ${err}`)
    })
  }

  get (id: string) {
    return new Promise<LLNG_Session>((resolve, reject) => {
      const opt: SearchOptions = {
        filter: `(objectClass=${this.class}`,
        scope: 'base',
        attributes: [this.contentAttr]
      }
      this.ldap.search(`${this.idAttr}=${id},${this.base}`, opt, (err, res) => {
        let data: string
        if (err) return reject(err)
        res.on('searchEntry', entry => {
          const tmp = entry.object[this.contentAttr]
          data = <string>entry.object[typeof tmp === 'object' ? tmp[0] : tmp]
        })
        res.on('error', err => {
          reject(`LDAP search failed: ${err}`)
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(`LDAP session parse error: ${e}`)
          }
        })
      })
    })
  }

  update (data: LLNG_Session) {
    return new Promise<boolean>((resolve, reject) => {
      const change = new ldapjs.Change({
        operation: 'modify',
        modification: {
          [this.contentAttr]: JSON.stringify(data)
        }
      })
      this.ldap.modify(
        `${this.idAttr}=${data._session_id},${this.base}`,
        change,
        err => {
          if (err) return reject(err)
          resolve(true)
        }
      )
    })
  }
}

export default LDAPSession
