const express = require('express')
const app = express()
const handler = require('../../')
const path = require('path')

const defer = new Promise((resolve, reject) => {
  handler
    .init({
      configStorage: {
        confFile: path.join(__dirname, 'lemonldap-ng.tmp.ini')
      }
    })
    .then(() => {
      app.use(handler.run)
      app.get('/', (req, res) => {
        res.status(200).send('Hello World!')
      })
      app.get('/dwho', (req, res) => {
        res.status(200).send('For dwho only!')
      })
      app.get('/headers', (req, res) => {
        res.status(200).send(JSON.stringify(req.headers))
      })
      app.get('/deny', (req, res) => {
        res.status(200).send('Should never be displayed!')
      })
      resolve(app)
    })
})

module.exports = defer
