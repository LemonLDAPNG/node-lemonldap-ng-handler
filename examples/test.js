var express = require('express');
var app = express();
var handler = require('node-lemonldap-ng-handler');

handler.init({
  configStorage: {
    "confFile": "../lemonldap/e2e-tests/conf/lemonldap-ng.ini"
  }
});

app.use(handler.run);

app.get('/', function(req, res) {
  res.setHeader('Content-Type','text/html');

  var tmp = '<table>';
  for(var k in req.headers) {
    if(!k.match(/(Accept|Cache|User-Agent|Connection|Keep-Alive)/i)) {
      var v = req.headers[k];
      tmp += '<tr><td id="h-'+k+'">'+k+'</td><td><tt>'+v+'</tt></td></tr>'
    }
  }
  tmp += '</table>';

  res.send('<!DOCTYPE html>'
  +'<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">'
  +'<head><title>Test page for Lemonldap::NG node handler</title></head>'
  +'<body>'
  +'<h1>Test page for Lemonldap::NG node handler</h1>'
  +'<h2>Main informations</h2>'
  +'<div><ul>'
  +'<li><tt>req.headers["Auth-User"]</tt>: '+req.headers["Auth-User"]+'</li>'
  +'</ul>'
  + '<h2 class="panel-title text-center">HTTP headers</h2>'
  + tmp
  +'</body></html>'
);

});

app.listen(3000, function() {
  return console.log('Example app listening on port 3000!');
});
