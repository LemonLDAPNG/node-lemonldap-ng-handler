import { LLNG_Session, Session_Accessor } from '@LLNG/types';
import { LimitedCache, LimitedCacheInstance } from 'limited-cache';
import nodePersist from 'node-persist';

class Session {
  backend: Session_Accessor | undefined;
  inMemoryCache: LimitedCacheInstance<LLNG_Session>;
  localCache: typeof nodePersist | undefined;

  constructor( type: string, opts: object = {} ) {
    import(`@LLNG/session-${this.aliases(type)}`).then( mod => {
      this.backend = new mod.default(opts);
    }).catch( e => {
      throw new Error(`Unable to load ${type}: ${e}`);
    });
    nodePersist.init({
      dir: '/tmp/node-llng-cache',
      ttl: 600000,
    }).then( () => {
      this.localCache = nodePersist;
    });
    this.inMemoryCache = LimitedCache<LLNG_Session>({maxCacheSize: 100, maxCacheTime: 120000});
  }

  aliases(type: string) {
    return type
      .toLowerCase()
      .replace(/.*apache::session::(?:browseable::)?/,'')
      .replace(/(?:pghstore|pgjson)/,'postgres');
  }

  get(id: string) {
    return new Promise<LLNG_Session>( (resolve, reject) => {
      if( this.backend === undefined ) return reject('Please wait for initialization');
      const backendGet = ( id: string, resolve: Function, reject: Function ): void => {
        // @ts-ignore: this.backend is defined
        this.backend.get(id).then( session => {
          this.inMemoryCache.set(id, session);
          if (this.localCache) this.localCache.set(id, session);
          resolve(session);
        })
        .catch( e => {
          reject(e);
        });
      }
      let lsession = this.inMemoryCache.get(id);
      if (lsession) {
        resolve(lsession);
      } else {
        if (this.localCache) {
          this.localCache.get(id).then( res => {
            if (res) {
              resolve(res);
            }
            else backendGet( id, resolve, reject);
          });
        } else backendGet( id, resolve, reject);
      }
    });
  }

  update(data: LLNG_Session): Promise<boolean> {
    return new Promise<boolean>( (resolve, reject) => {
      if( this.backend === undefined ) return reject('Please wait for initialization');
      this.backend.update(data).then( res => {
        this.inMemoryCache.set( data._session_id, data );
        resolve(res);
      })
      .catch( e => {
        reject(e);
      });
    });
  }
}

export default Session;
