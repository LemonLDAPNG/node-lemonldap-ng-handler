# Lemonldap::NG handler for Node.js

Experimental Lemonldap::NG handler for node.js

## SYNOPSIS

### lemonldap-ng.ini
```ini
...
[node-handler]

nodeVhosts = test.example.com, test2.example.com
```

### Express app
```javascript
// Variables
var express = require('express');
var app = express();
var handler = require('node-lemonldap-ng-handler');

// initialize handler (optional args)
handler.init({
  configStorage: {
    "confFile":"test/lemonldap-ng.ini"
  }
});

// and load it
app.use(handler.run);

// Then simply use your express app
app.get('/', function(req, res) {
  return res.send('Hello ' + req.headers['Auth-User'] + ' !');
});
app.listen(3000, function() {
  return console.log('Example app listening on port 3000!');
});
```

### Nginx authorization server

FastCGI server:
```javascript
var handler = require('node-lemonldap-ng-handler');

handler.init({
  configStorage: {
    "confFile": "/path/to/lemonldap-ng.ini"
  }
});

handler.nginxServer({
  "mode": "fcgi",   // or "http", default: fcgi
  "port": 9090,     // default value
  "ip": 'localhost' // default value
});
```

Nginx configuration. For more, see [Nginx configuration on LLNG website](https://lemonldap-ng.org/documentation/2.0/configvhost#nginx_configuration)
```nginx
server {
  listen 19876;
  server_name test.example.com;
  root /home/xavier/dev/lemonldap/e2e-tests/conf/site;

  # Internal authentication request
  location = /lmauth {
    internal;
    include /etc/nginx/fastcgi_params;
    fastcgi_pass localhost:9090;

    # Drop post datas
    fastcgi_pass_request_body  off;
    fastcgi_param CONTENT_LENGTH "";

    # Keep original hostname
    fastcgi_param HOST $http_host;

    # Keep original request (LLNG server will received /llauth)
    fastcgi_param X_ORIGINAL_URI  $request_uri;
  }

  # Client requests
  location / {
    auth_request /lmauth;
    auth_request_set $lmremote_user $upstream_http_lm_remote_user;
    auth_request_set $lmlocation $upstream_http_location;
    error_page 401 $lmlocation;
    include conf/nginx-lua-headers.conf;
  }

}
```

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
* CDBI _(MySQL, PostgreSQL and SQLite3 only)_

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

### Configuration backends

Node-lemonldap-ng-handler is compatible with the following Lemonldap::NG
backends:
* CDBI
* File

### Sessions backends

Node-lemonldap-ng-handler is compatible with the following Lemonldap::NG
backends:
* Apache::Session::File, Apache::Session::Browseable::File
* Apache::Session::MySQL, Apache::Session::Browseable::MySQL
* Apache::Session::Postgres, Apache::Session::Browseable::Postgres
* Apache::Session::SQLite3, Apache::Session::Browseable::SQLite3

### Special handlers

Node-lemonldap-ng-handler can be used as
 * [DevOps handler](https://lemonldap-ng.org/documentation/2.0/devopshandler)
 * [ServiceToken handler](https://lemonldap-ng.org/documentation/2.0/servertoserver)

You just have to specify `"type":<type>` in `init()` arguments. Example:
```javascript
handler.init({
  "type": "DevOps",
  "configStorage": {
    "confFile": "/path/to/lemonldap-ng.ini"
  }
});
```

## TODO

* Custom functions
* Copy Safelib.pm
* Think to menu problem
* REST backends

## BUG REPORT

Use OW2 system to report bug or ask for features:
[LLNG OW2 GitLab](https://gitlab.ow2.org/lemonldap-ng/lemonldap-ng/issues)

## DOWNLOAD

Lemonldap::NG is available at
https://gitlab.ow2.org/lemonldap-ng/lemonldap-ng/tags

This library is available at
https://github.com/LemonLDAPNG/node-lemonldap-ng-handler

## COPYRIGHT AND LICENSE

Copyright (C) 2016-2018 by [Xavier Guimard](mailto:x.guimard@free.fr)

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

