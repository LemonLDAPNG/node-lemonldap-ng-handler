Changelog
=========

## 0.6.0

 * Rewrite to Typescript and then find and fix a lot of bugs
 * Fix SQL support for Node.js >= 14
 * BREACKING CHANGES:
   * SQL stack changed: [perl-dbi](./packages/perl-dbi/README.md) is now based
     on [Knex](https://www.npmjs.com/package/knex). If you are using a SQL
     database, you have to install the related module:
     * PostgreSQL: [pg](https://www.npmjs.com/package/pg)
     * MySQL: [mysql](https://www.npmjs.com/package/mysql)
     * Oracle: [oracledb](https://www.npmjs.com/package/oracledb)

## 0.5.5

 * LDAP: custom CA support
 * Build deps: add missing iconv, ipaddr.js, random-bytes
 * Fix URL normalizaion

Thanks to Samuel Martin Moro to have fixed this points

## 0.5.4
 * Switch to lerna

## 0.5.2
 * Better URL normalization (see CVE-2020-24660)

## 0.5.1
 * Don't fail if configuration is not ready but return 503 (#4)

## 0.5.0
 * BREAKING CHANGE:
   * Cryptographic functions are now compatible with LLNG ≥ 2.0.5 but then
     may be incompatible with previous versions.

## 0.4.0
 * Reorganize and rename main package to "lemonldap-ng-handler"

## 0.3.0 - 2018-07-01
 * Add UWSGI logger
 * Fix "skip" management (#1)

## 0.2.9 - 2018-06-07
 * Bug: bad host header in DevOps rules.json query
 * Add DevOpsST handler

## 0.2.8 - 2018-05-29
 * Bug: bad conf order in fileConf when cfgNum>9
 * Change bug database to OW2 GitLab
 * Add YAMLFile configuration backend
 * Add LDAP configuration backend
 * Add LDAP session backend

## 0.2.7 - 2018-05-24
 * Add MongoDB configuration backend

## 0.2.6 - 2018-05-21
 * Propagate vm in DevOps handler

## 0.2.5 - 2018-05-21
 * Fix bug in rules compilation
 * Replace `eval` calls by execution in Node.js vm

## 0.2.4 - 2018-05-20
 * Fix bug when old session exists (fileSession)
 * Add missing header Lm-Remote-User

## 0.2.3 - 2018-05-17
 * Fix bug in DevOps handler when RULES\_URL is used
 * Fix bug in REST configuration backend
 * replace is-in-subnet dependency by ipaddr.js (more easy to build and
   available in Debian)
 * Add REST sessions backend

## 0.2.2 - 2018-05-13
 * Use mocha for test
 * Evaluate Perl hash in lemonldap-ng.ini file
 * Add Redis session backend
 * Add all [extended function](https://lemonldap-ng.org/documentation/2.0/extendedfunctions)

## 0.2.1 - 2018-05-09
 * Add logger system (Std and Syslog)
 * Fix inheritance error in DevOps handler

## 0.2.0 - 2018-05-03
 * Move nodedbi to optionalDependencies
 * Use SPDX license name

## 0.1.9 - 2018-05-02
 * Add Apache::Session::Browseable::{PgHstore,PgJSON} support
 * Add REST conf backend
 * Switch to nodedbi (instead of node-dbi) for DB access

## 0.1.8 - 2018-04-23
 * Fix "Unable to give options to nginxServer"
 * Add RDBI support

## 0.1.7 - 2018-04-22
 * Missing compilation for ServiceToken

## 0.1.6 - 2018-04-22
 * Crypto lib
 * Handlers:
   - ServiceToken
   - DevOps

## 0.1.5 - 2018-04-16
 * Update doc links

## 0.1.4 - 2018-04-16

 * Add Nginx authorization server support
