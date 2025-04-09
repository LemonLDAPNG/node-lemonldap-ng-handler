# Lemonldap::NG handler for Node.js

Beta [Lemonldap::NG](https://lemonldap-ng.org) handler for node.js

## packages

- Main package: [lemonldap-ng-handler](./packages/handler/README.md)
- Configuration:
  - Main class: [@lemonldap-ng/conf](./packages/conf/README.md)
  - Configuration backends: [@lemonldap-ng/conf-\*](./packages/)
- Perl Apache::Session::\* wrapper:
  - Main class: [@lemonldap-ng/session](./packages/session/README.md)
  - Session backends: [@lemonldap-ng/session-\*](./packages/)
- Perl-DBI wrapper: [perl-dbi](./packages/perl-dbi/README.md)
- Crypto API: [@lemonldap-ng/crypto](./packages/crypto/README.md)
- Constants: [@lemonldap-ng/constants](./packages/constants)
- Global typescript types: [@lemonldap-ng/types](./packages/types)

## What is [LemonLDAP::NG](https://lemonldap-ng.org)

Lemonldap::NG is a complete Web-SSO system that can run with reverse-proxies
or directly on application webservers. It can be used in conjunction with
OpenID-Connect, CAS and SAML systems as identity or service provider. It can
also be used as proxy between those federation systems.

It manages both authentication and authorization and provides headers for
accounting. So you can have a full AAA protection. Authorization are built by
associating a regular expression and a rule. Regular expression is applied on
the requested URL and the rule calculates if the user is authorized.

LLNG is designed in 3 kinds of elements:

- a portal
- a manager
- some handlers for Apache, [Plack family](https://plackperl.org), Node.js
- some FastCGI servers to provide Nginx handler or
  [SSOaaS](https://lemonldap-ng.org/documentation/2.0/ssoaas):
  - pure Perl (default)
  - uWSGI _(Perl via uwsgi-psgi plugin)_
  - this Node.js module

This module provide the Node.js handler and the FastCGI server.

See [Lemonldap::NG website](http://lemonldap-ng.org) for more.

## Copyright and license

Copyright (C) 2016-present Yadd <yadd@debian.org>

Licensed under [GNU GPL V3](./LICENSE)
