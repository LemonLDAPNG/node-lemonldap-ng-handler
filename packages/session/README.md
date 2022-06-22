# @lemonldap-ng/session

@lemonldap-ng/session is the session accessor.

## Synopsis

```typescript
import Session from '@lemonldap-ng/session'
import { LLNG_Session } from '@lemonldap-ng/types' // typescript only

const sessionAccessor = new Session({
  storageModule: 'Apache::Session::File',
  storageModuleOptions: {
    Directory: '/path/to/session/dir',
  },
  // Optional
  cacheModule: 'any value: it uses "node-persist"'
  cacheModuleOptions: {
    cache_root: '/path/to/Perl/cache', // it will use /path/to/Perl/cache.node-llng-cache to avoid conflicts
    default_expires_in: 600, // 600 seconds is the default value
  },
})

sessionAccessor.ready.then( () => {
  // ready to search/update a session
  sessionAccessor.get("id").then( (session: LLNG_Session) => {
    // do what you want. Example: update
    sessionAccessor.update(session).then( () => {
      console.log(`session ${id} updated`)
    }).catch( e => { throw new Error(e) })
  })
  .catch( e => {
    console.error('Session not found')
  })
})
```

@lemonldap-ng/session is a component of [lemonldap-ng-handler](https://www.npmjs.com/package/lemonldap-ng-handler),
a Node.js handler for [LemonLDAP::NG WebSSO](https://lemonldap-ng.org).
