# @LLNG/crypto

@LLNG/crypto provide encrypt/decrypt methods used by [LemonLDAP::NG system](https://lemonldap-ng.org).

This library is compatible with LemonLDAP::NG >= 2.0.5.

Usage:
```js
import Crypto from '@LLNG/crypto`;
import {expect} from 'expect';
// or with expect < 28
import expect from 'expect';

const encrypter = new Crypto(key); // key is an ascii string, the real key is sha256(key)

let encryptedString = encrypter.encrypt(data);

let decryptedString = encrypter.decrypt(encryptedString);

expect(decryptedString).toEqual(data)

```

@LLNG/conf-cdbi is a component of [lemonldap-ng-handler](https://www.npmjs.com/package/lemonldap-ng-handler)

## BUG REPORT AND OTHER ISSUES

Use OW2 system to report bug or ask for features:
[LLNG OW2 GitLab](https://gitlab.ow2.org/lemonldap-ng/lemonldap-ng/issues)
