# @lemonldap-ng/logger

@lemonldap-ng/logger is the main logger

## Synopsis

```typescript
import Logger from "@lemonldap-ng/logger";
import { LLNG_Conf } from "@lemonldap-ng/types"; // typescript only

const userLogger = true;

const conf: LLNG_Conf = {
  // use @lemonldap-ng/conf to get it
  userLogger: "Lemonldap::NG::Common::Logger::Syslog",
};

Logger(conf, userLogger).then((userLogger) => {
  userLogger.notice("I'm connected to syslog");
});
```

@lemonldap-ng/logger is a component of [lemonldap-ng-handler](https://www.npmjs.com/package/lemonldap-ng-handler),
a Node.js handler for [LemonLDAP::NG WebSSO](https://lemonldap-ng.org).
