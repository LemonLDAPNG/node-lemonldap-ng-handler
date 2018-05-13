Changelog
=========

## 0.2.3
 * Fix bug in DevOps handler when RULES\_URL is used
 * replace is-in-subnet dependency by ipaddr.js (more easy to build and
   available in Debian)

## 0.2.2
 * Use mocha for test
 * Evaluate Perl hash in lemonldap-ng.ini file
 * Add Redis session backend
 * Add all [extended function](https://lemonldap-ng.org/documentation/2.0/extendedfunctions)

## 0.2.1
 * Add logger system (Std and Syslog)
 * Fix inheritance error in DevOps handler

## 0.2.0
 * Move nodedbi to optionalDependencies
 * Use SPDX license name

## 0.1.9
 * Add Apache::Session::Browseable::{PgHstore,PgJSON} support
 * Add REST conf backend
 * Switch to nodedbi (instead of node-dbi) for DB access

## 0.1.8
 * Fix "Unable to give options to nginxServer"
 * Add RDBI support

## 0.1.7
 * Missing compilation for ServiceToken

## 0.1.6
 * Crypto lib
 * Handlers:
   - ServiceToken
   - DevOps

## 0.1.5
 * Update doc links

## 0.1.4

 * Add Nginx authorization server support
