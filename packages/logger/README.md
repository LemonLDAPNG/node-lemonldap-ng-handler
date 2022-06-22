# @LLNG/logger

@LLNG/logger is the main logger

## Synopsis

```typescript
import Logger from '@LLNG/logger'
import {LLNG_Conf} from '@LLNG/types' // typescript only

const userLogger = true

const conf: LLNG_Conf = {
  // use @LLNG/conf to get it
  userLogger: 'Lemonldap::NG::Common::Logger::Syslog',
}

Logger(conf, userLogger).then( userLogger => {
  userLogger.notice("I'm connected to syslog")
})
```

@LLNG/logger is a component of [lemonldap-ng-handler](https://www.npmjs.com/package/lemonldap-ng-handler),
a Node.js handler for [LemonLDAP::NG WebSSO](https://lemonldap-ng.org).
