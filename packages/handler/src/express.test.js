const request = require("supertest");
const path = require('path');
const fs = require('fs');
const ini = require('ini');

const iniSrc = path.join(__dirname,"__testData__","lemonldap-ng.ini");
const iniTmp = path.join(__dirname,"__testData__","lemonldap-ng.tmp.ini");
const lmconfSrc = path.join(__dirname,"__testData__","conf-1.json");
const lmconfTmp = path.join(__dirname,"__testData__","lmConf-1.json");
const sessionsDir = path.join(__dirname,"__testData__","sessions");
let app;

beforeAll((done) => {
  let content = ini.parse(fs.readFileSync(iniSrc, 'utf-8'));
  content.configuration.dirName = path.join(__dirname,"__testData__");
  fs.writeFileSync(iniTmp, ini.stringify(content));
  content = fs.readFileSync(lmconfSrc, 'utf-8')
    .replace(/__SESSIONDIR__/g, sessionsDir);
  fs.writeFileSync(lmconfTmp, content);
  fs.mkdirSync(sessionsDir);
  let mod = require("./__testData__/express-app.js");
  mod
    .then( res => { app = res; done() } )
    .catch( e => { throw new Error(e) } );
});

afterAll(() => {
  fs.rmSync(iniTmp);
  fs.rmSync(lmconfTmp);
  fs.rmSync(sessionsDir, {recursive: true});
});

test("It should redirect unauthentified requests", done => {
  request(app).get("/").then(response => {
    expect(response.status).toEqual(302);
    expect(response.headers.location).toMatch(new RegExp('^http://auth.example.com/\\?url='));
    done();
  });
});
