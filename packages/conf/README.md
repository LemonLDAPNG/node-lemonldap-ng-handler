# @lemonldap-ng/conf

@lemonldap-ng/conf is the configuration accessor.

## Synopsis

```typescript
import Conf from '@lemonldap-ng/conf'
import {LocalConf} from '@lemonldap-ng/types' // typescript only

const minimalConf: LocalConf = {
  confFile: '/path/to/lemonldap-ng.ini' // default to /etc/lemonldap-ng/lemonldap-ng.ini
}

const confAccessor = new Conf(localConf)

// read a lemonldap-ng.ini section
const localConf = confAccessor.getLocalConf('node-handler')

// get configuration from LemonLDAP::NG database
confAccessor.getConf().then ( (conf: LLNG_Conf) => {
  //
}).catch( e => {
  throw new Error(e)
})
```

@lemonldap-ng/conf is a component of [lemonldap-ng-handler](https://www.npmjs.com/package/lemonldap-ng-handler),
a Node.js handler for [LemonLDAP::NG WebSSO](https://lemonldap-ng.org).
