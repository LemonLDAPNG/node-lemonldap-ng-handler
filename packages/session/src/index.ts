import { LLNG_Session, Session_Accessor } from '@LLNG/types';

import { LimitedCache, LimitedCacheInstance } from 'limited-cache';

class Session {
  backend: Session_Accessor | undefined;
  cache: LimitedCacheInstance<LLNG_Session>;

  constructor( type: string, opts: object = {} ) {
    import(`@LLNG/session-${this.aliases(type)}`).then( mod => {
      this.backend = new mod.default(opts);
    }).catch( e => {
      throw new Error(`Unable to load ${type}: ${e}`);
    });
    this.cache = LimitedCache<LLNG_Session>({maxCacheSize: 100});
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
      let lsession = this.cache.get(id);
      if (lsession) {
        resolve(lsession);
      } else {
        this.backend.get(id).then( session => {
          this.cache.set(id, session);
          resolve(session);
        })
        .catch( e => {
          reject(e);
        });
      }
    });
  }

  update(data: LLNG_Session): Promise<boolean> {
    return new Promise<boolean>( (resolve, reject) => {
      if( this.backend === undefined ) return reject('Please wait for initialization');
      this.backend.update(data).then( res => {
        this.cache.set( data._session_id, data );
        resolve(res);
      })
      .catch( e => {
        reject(e);
      });
    });
  }
}

export default Session;
