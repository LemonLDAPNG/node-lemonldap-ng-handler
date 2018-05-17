Changelog
=========

## 0.2.3
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
