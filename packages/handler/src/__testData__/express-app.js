const express = require('express');
const app = express();
const handler = require('../../');
const path = require('path');


const defer = new Promise( (resolve, reject) => {
  handler.init({
    configStorage: {
      "confFile": path.join(__dirname, 'lemonldap-ng.tmp.ini')
    },
  }).then( () => {
    app.use(handler.run);
    app.get('/', (req, res) => {
      res.status(200).send("Hello World!");
    });
    resolve(app);
  });

});

module.exports = defer;
