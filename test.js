var express = require('express');
var app = express();
var handler = require('./LlngHandler');

handler.init({configStorage:{"confFile":"test/lemonldap-ng.ini"}});

console.log(handler);

app.use(handler.run);

app.get('/', function(req, res) {
  return res.send('Hello World!');
});

app.listen(3000, function() {
  return console.log('Example app listening on port 3000!');
});
