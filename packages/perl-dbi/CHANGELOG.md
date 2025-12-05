# Changelog

## 0.6.0

### Breaking change

- Rewrite to Typescript and then find and fix a lot of bugs
- Fix SQL support for Node.js >= 14
- BREACKING CHANGES:
  - SQL stack changed: [perl-dbi](./packages/perl-dbi/README.md) is now based
    on [Knex](https://www.npmjs.com/package/knex). If you are using a SQL
    database, you have to install the related module:
    - PostgreSQL: [pg](https://www.npmjs.com/package/pg)
    - MySQL: [mysql](https://www.npmjs.com/package/mysql)
    - Oracle: [oracledb]](https://www.npmjs.com/package/oracledb)

## 0.2.0 - 2018-05-03

- Move nodedbi to optionalDependencies

## 0.1.9 - 2018-05-02

- Switch to nodedbi (instead of node-dbi) for DB access

## 0.1.8 - 2018-04-23

- Fix "Unable to give options to nginxServer"
- Add RDBI support
