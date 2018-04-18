{
  "applicationList": {
    "0001-cat": {
      "catname": "Sample applications",
      "0002-app": {
        "options": {
          "description": "A simple application displaying authenticated user",
          "display": "auto",
          "logo": "demo.png",
          "name": "Application Test 1",
          "uri": "http://test1.example.com:__port__/"
        },
        "type": "application"
      },
      "0003-app": {
        "options": {
          "description": "The same simple application displaying authenticated user",
          "display": "auto",
          "logo": "thumbnail.png",
          "name": "Application Test 2",
          "uri": "http://test2.example.com:__port__/"
        },
        "type": "application"
      },
      "type": "category"
    },
    "0004-cat": {
      "catname": "Administration",
      "0005-app": {
        "options": {
          "description": "Configure LemonLDAP::NG WebSSO",
          "display": "auto",
          "logo": "configure.png",
          "name": "WebSSO Manager",
          "uri": "http://manager.example.com:__port__/manager.html"
        },
        "type": "application"
      },
      "0006-app": {
        "options": {
          "description": "Explore WebSSO notifications",
          "display": "auto",
          "logo": "database.png",
          "name": "Notifications explorer",
          "uri": "http://manager.example.com:__port__/notifications.html"
        },
        "type": "application"
      },
      "0007-app": {
        "options": {
          "description": "Explore WebSSO sessions",
          "display": "auto",
          "logo": "database.png",
          "name": "Sessions explorer",
          "uri": "http://manager.example.com:__port__/sessions.html"
        },
        "type": "application"
      },
      "type": "category"
    },
    "0008-cat": {
      "catname": "Documentation",
      "0009-app": {
        "options": {
          "description": "Documentation supplied with LemonLDAP::NG",
          "display": "on",
          "logo": "help.png",
          "name": "Local documentation",
          "uri": "http://manager.example.com:__port__/doc/"
        },
        "type": "application"
      },
      "0010-app": {
        "options": {
          "description": "Official LemonLDAP::NG Website",
          "display": "on",
          "logo": "network.png",
          "name": "Offical Website",
          "uri": "http://lemonldap-ng.org/"
        },
        "type": "application"
      },
      "type": "category"
    }
  },
  "authentication": "Demo",
  "cfgAuthor": "The LemonLDAP::NG team",
  "cfgAuthorIP": "127.0.0.1",
  "cfgDate": 1428138808,
  "cfgLog": "Default configuration provided by LemonLDAP::NG team",
  "cfgNum": "1",
  "cookieName": "lemonldap",
  "customFunctions": "My::hello My::get_uri My::get_additional_arg",
  "demoExportedVars": {
    "cn": "cn",
    "mail": "mail",
    "uid": "uid"
  },
  "domain": "example.com",
  "exportedHeaders": {
    "test1.example.com": {
      "Auth-User": "$uid",
      "Ip-Addr": "$ipAddr"
    },
    "test2.example.com": {
      "Auth-User": "$uid"
    }
  },
  "exportedVars": {
    "UA": "HTTP_USER_AGENT"
  },
  "globalStorage": "Apache::Session::File",
  "globalStorageOptions": {
    "Directory": "test/sessions",
    "LockDirectory": "test/sessions/lock",
    "generateModule": "Lemonldap::NG::Common::Apache::Session::Generate::SHA256"
  },
  "groups": {},
  "key": "qwertyui",
  "localSessionStorageOptions": {
    "cache_depth": 3,
    "cache_root": "__pwd__/e2e-tests/conf",
    "default_expires_in": 600,
    "directory_umask": "007",
    "namespace": "lemonldap-ng-sessions"
  },
  "locationRules": {
    "manager.example.com": {
      "(?#Configuration)^/(manager\\.html|conf/)": "$uid === \"dwho\"",
      "(?#Notifications)^/notifications": "$uid === \"dwho\" || $uid === \"rtyler\"",
      "(?#Sessions)^/sessions": "$uid === \"dwho\" || $uid === \"rtyler\"",
      "default": "$uid === \"dwho\""
    },
    "test1.example.com": {
      "^/logout": "logout_sso",
      "^/deny": "deny",
      "^/rtyler": "$uid === 'rtyler'",
      "^/dwho": "$uid === 'dwho'",
      "default": "accept"
    },
    "test2.example.com": {
      "^/logout": "logout_sso",
      "default": "accept"
    }
  },
  "loginHistoryEnabled": 1,
  "macros": {
    "_whatToTrace": "$_auth === 'SAML' ? \"$_user\\@$_idpConfKey\" : \"$_user\""
  },
  "notification": 1,
  "notificationStorage": "File",
  "notificationStorageOptions": {
    "dirName": "__pwd__/e2e-tests/conf"
  },
  "passwordDB": "Demo",
  "persistentStorage": "Apache::Session::File",
  "persistentStorageOptions": {
    "Directory": "__pwd__/e2e-tests/conf/persistents",
    "LockDirectory": "__pwd__/e2e-tests/conf/persistents/lock",
    "generateModule": "Lemonldap::NG::Common::Apache::Session::Generate::SHA256"
  },
  "portal": "http://auth.example.com:19876/",
  "post": {
    "test2.example.com": {},
    "manager.example.com": {},
    "test1.example.com": {
      "/form.html": {
        "vars": [
          ["postuid", "$_user"],
          ["postmail", "'x@x.org'"],
          ["poststatic", "'static content'"]],
        "jqueryUrl": "http://manager.example.com:19876/static/bwr/jquery/dist/jquery.js",
        "buttonSelector": "#bt",
        "formSelector": "#test",
        "target": "/index.pl"
      }
    }
  },
  "registerDB": "Null",
  "reloadUrls": {},
  "securedCookie": 0,
  "sessionDataToRemember": {},
  "timeout": 72000,
  "userDB": "Demo",
  "whatToTrace": "_whatToTrace"
}
