import fetch from 'node-fetch'
import { Apache_Session, LLNG_Session, Session_Accessor } from '@LLNG/types'
type SessionREST_Args = {
  baseUrl: string
  user?: string
  password?: string
}

class RESTSession implements Session_Accessor {
  baseUrl: string
  user: string | undefined
  password: string | undefined

  constructor (args: SessionREST_Args) {
    if (!args.baseUrl)
      throw new Error('baseUrl parameter is required in REST configuration')

    if (!args.baseUrl.match(/(https?):\/\/([^\/:]+)(?::(\d+))?(.*)/))
      throw new Error(`Bad URL ${args.baseUrl}`)

    this.baseUrl = args.baseUrl.replace(/\/+$/, '')
    if (args.user) {
      this.user = args.user
      if (!args.password) throw new Error('password required')
      this.password = args.password
    }
  }

  get (id: string) {
    return new Promise<LLNG_Session>((resolve, reject) => {
      this.query('get', id)
        .then((res: LLNG_Session) => {
          resolve(res)
        })
        .catch(e => reject(e))
    })
  }

  update (data: LLNG_Session) {
    return new Promise<boolean>((resolve, reject) => {
      reject('TODO')
    })
  }

  query (method: string, query: string) {
    return new Promise<LLNG_Session>((resolve, reject) => {
      const headers: { Accept: string; Authorization?: string } = {
        Accept: 'application/json'
      }
      if (this.user) {
        headers.Authorization =
          'Basic ' +
          Buffer.from(`${this.user}:${this.password}`).toString('base64')
      }
      const url = this.baseUrl + (this.baseUrl.match(/\/$/) ? '' : '/') + query
      fetch(url, {
        method: method,
        headers
      })
        .then(response => {
          if (response.status !== 200) {
            reject(response.status)
          } else {
            return response.json() as Promise<LLNG_Session>
          }
        })
        .then(value => {
          if (typeof value !== 'object') return reject('Bad JSON response')
          resolve(value as LLNG_Session)
        })
        .catch(err => reject(err))
    })
  }
}

export default RESTSession
