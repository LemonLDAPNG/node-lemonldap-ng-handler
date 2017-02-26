# Lemonldap::NG handler for Node.js

Experimental Lemonldap::NG handler for node.js

If the job runs well, it will be integrated to version 2.0.0 of Lemonldap::NG.

## SYNOPSIS

    # Variables
    var express = require('express');
    var app = express();
    var handler = require('node-lemonldap-ng-handler');
    #
    # initialize handler (optional args)
    handler.init({
      configStorage: {
        "confFile":"test/lemonldap-ng.ini"
      }
    });
    #
    # and load it
    app.use(handler.run);
    #
    # Then simply use your express app
    app.get('/', function(req, res) {
      return res.send('Hello ' + req.headers['Auth-User'] + ' !');
    });
    app.listen(3000, function() {
      return console.log('Example app listening on port 3000!');
    });

## DESCRIPTION

Lemonldap::NG is a complete Web-SSO system that can run with reverse-proxies
or directly on application webservers. It can be used in conjunction with
OpenID-Connect, CAS and SAML systems as identity or service provider. It can
also be used as proxy between those federation systems.

It manages both authentication and authorization and provides headers for
accounting. So you can have a full AAA protection. Authorization are built by
associating a regular expression and a rule. Regular expression is applied on
the requested URL and the rule calculates if the user is authorized.

LLNG is designed in 3 kinds of elements:
* a portal
* some handlers for Apache, Nginx or Node.js
* a manager

This module is the Node.js handler. See [Lemonldap::NG website](http://lemonldap-ng.org)
for more.

## INSTALLATION

Of course, you must have a [LemonLDAP::NG](https://lemonldap-ng.org) system
installed in your organization. To install node handler, use simply:

    npm install node-lemonldap-ng-handler

## CONFIGURATION

### Configuration file *(lemonldap-ng.ini)*

Node-lemonldap-ng-handler uses LemonLDAP::NG configuration file, sections
`[configuration]` and `[node-handler]`.

> **Note important**: node-lemonldap-ng-handler can't read multilines in
lemonldap-ng.ini. You must rewrite them on one line *(even in other sections)*.

#### Section `[configuration]`

Nothing to change, node-lemonldap-ng-handler is compatible with the following
LemonLDAP::NG backends:
* File
* CDBI

#### New section `[node-handler]`

You can overwrite here LemonLDAP::NG configuration keys. You must set the list
of virtual hosts handled by node.js in key `nodeVhosts`.

Example:

    [node-handler]
    nodeVhosts = test1.example.com, test2.example.com

**Rules and headers must be written in Javascript**, not in Perl. Example:

    default: $uid == 'dwho'
    ^/deny : deny

You'll have a warning in the manager when saving this rules since Perl doesn't
understand Javascript.

### Sessions backends

Node-lemonldap-ng-handler is compatible with the following Lemonldap::NG
backends:
* Apache::Session::File, Apache::Session::Browseable::File
* Apache::Session::MySQL, Apache::Session::Browseable::MySQL
* Apache::Session::Postgres, Apache::Session::Browseable::Postgres
* Apache::Session::SQLite3, Apache::Session::Browseable::SQLite3

## TODO

* Custom functions
* Copy Safelib.pm
* Think to menu problem
* REST backends

## BUG REPORT

Use OW2 system to report bug or ask for features:
[LLNG OW2 Jira](https://jira.ow2.org/browse/LEMONLDAP/)

## DOWNLOAD

Lemonldap::NG is available at
http://forge.objectweb.org/project/showfiles.php?group_id=274

This library is available at
https://github.com/LemonLDAPNG/node-lemonldap-ng-handler

## COPYRIGHT AND LICENSE

Copyright (C) 2016-2017 by [Xavier Guimard](mailto:x.guimard@free.fr)

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

