# perl-dbi

perl-dbi is a wrapper around [database-js](https://github.com/mlaanderson/database-js#readme)
that accept Perl DBI stype arguments.

To use it, you should install the related driver:
```shell
npm install perl-dbi
npm install database-js-postgres
# or
npm install database-js-mysql
# or
npm install database-js-sqlite
```

Example:
```js
import PerlDBI from 'perl-dbi';

var conn = new PerlDBI({
  dbiChain:    'dbi:Pg:dbname=mydb;host=1.2.3.4',
  dbiUser:     'pguser',
  dbiPassword: 'pgpassword'
});

var stmt1 = conn.prepareStatement("SELECT * FROM city WHERE name = ?");
stmt1.query("New York")
  .then( function (results) {
    console.log(results); // Display the results
  ).catch( function (reason) {
    console.log(reason); // Some problem while performing the query
  } );
```

perl-dbi is a component of [lemonldap-ng-handler](https://www.npmjs.com/package/lemonldap-ng-handler)

## BUG REPORT AND OTHER ISSUES

Use OW2 system to report bug or ask for features:
[LLNG OW2 GitLab](https://gitlab.ow2.org/lemonldap-ng/lemonldap-ng/issues)

## COPYRIGHT AND LICENSE

Copyright (C) 2016-2019 by [Yadd](mailto:yadd@debian.org)

This library is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2, or (at your option)
any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see http://www.gnu.org/licenses/.
