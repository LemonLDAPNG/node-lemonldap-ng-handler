import { createClient, RedisClientType } from 'redis'
import { LLNG_Session, Session_Accessor } from '@LLNG/types'
type SessionRedis_Args = {
  server: string | undefined
  user: string | undefined
  password: string | undefined
  client: RedisClientType | undefined
}

class RedisSession implements Session_Accessor {
  client: RedisClientType

  constructor (args: SessionRedis_Args) {
    if (!args.server) args.server = 'localhost'
    let port = 6379
    if (args.server.match(/(.*?):(\d+)/)) {
      args.server = RegExp.$1
      port = parseInt(RegExp.$2)
    }
    let url = 'redis://'
    if (args.user) {
      url += args.user
      if (args.password) url += `:${args.password}`
      url += '@'
    }
    url += `${args.server}:${port}/`
    if (args.client) {
      this.client = args.client
    } else {
      this.client = createClient({ url })
      this.client
        .connect()
        .then(() => {
          console.debug('Connected to redis server')
        })
        .catch(e => {
          throw new Error('Connection failed: ' + e)
        })
    }
  }

  get (id: string) {
    return new Promise<LLNG_Session>(async (resolve, reject) => {
      try {
        const data = await this.client.get(id)
        if (data !== undefined) {
          resolve(JSON.parse(data!))
        } else {
          reject('No session found')
        }
      } catch (e) {
        reject(e)
      }
    })
  }

  update (data: LLNG_Session) {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        await this.client.set(data._session_id, JSON.stringify(data))
        resolve(true)
      } catch (e) {
        reject(e)
      }
    })
  }
}

export default RedisSession
