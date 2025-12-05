# perl-dbi

perl-dbi is a wrapper around [knex](http://knexjs.org/)
that accept Perl DBI style arguments.

To use it, you should install the related driver:

```shell
npm install perl-dbi
npm install pg
# or
npm install mysql
# or
npm install sqlite3
```

Example:

```js
import PerlDBI from "perl-dbi";

var conn = new PerlDBI({
  dbiChain: "dbi:Pg:dbname=mydb;host=1.2.3.4",
  dbiUser: "pguser",
  dbiPassword: "pgpassword",
});
```

then use it like a [knex](http://knexjs.org/) object

perl-dbi is a component of [lemonldap-ng-handler](https://www.npmjs.com/package/lemonldap-ng-handler),
a Node.js handler for [LemonLDAP::NG WebSSO](https://lemonldap-ng.org).
