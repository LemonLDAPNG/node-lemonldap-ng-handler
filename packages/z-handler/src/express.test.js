const request = require("supertest");
const path = require("path");
const fs = require("fs");
const ini = require("ini");
const SafeLib = require("@lemonldap-ng/safelib");
const Crypto = require("@lemonldap-ng/crypto");

const iniSrc = path.join(__dirname, "__testData__", "lemonldap-ng.ini");
const iniTmp = path.join(__dirname, "__testData__", "lemonldap-ng.tmp.ini");
const lmconfSrc = path.join(__dirname, "__testData__", "conf-1.json");
const lmconfTmp = path.join(__dirname, "__testData__", "lmConf-1.json");
const sessionsDir = path.join(__dirname, "__testData__", "sessions");
const sessionSrc = path.join(__dirname, "__testData__", "session.json");

const crypto = new Crypto("azertyyuio");

const cipher = new SafeLib({
  cipher: crypto,
});

let app;

beforeAll(() => {
  // build lemonldap-ng.ini
  let content = ini.parse(fs.readFileSync(iniSrc, "utf-8"));
  content.configuration.dirName = path.join(__dirname, "__testData__");
  fs.writeFileSync(iniTmp, ini.stringify(content));

  // build lmConf-1.json
  content = fs
    .readFileSync(lmconfSrc, "utf-8")
    .replace(/__SESSIONDIR__/g, sessionsDir);
  fs.writeFileSync(lmconfTmp, content);

  // build sessions
  fs.mkdirSync(sessionsDir);
  const date = cipher.date();
  const perlTimestamp = Math.round(Date.now() / 1000).toString();
  content = JSON.parse(fs.readFileSync(sessionSrc, "utf-8"));
  ["_lastAuthnUTime", "_utime"].forEach((k) => {
    content[k] = perlTimestamp;
  });
  ["_updateTime", "_startTime"].forEach((k) => {
    content[k] = date;
  });
  fs.writeFileSync(
    path.join(sessionsDir, "dwhosession"),
    JSON.stringify(content),
  );
  content.uid = "rtyler";
  fs.writeFileSync(
    path.join(sessionsDir, "rtylersession"),
    JSON.stringify(content),
  );
});

let warnSpy, errorSpy;
beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn");
  errorSpy = jest.spyOn(console, "error");
});

afterAll(() => {
  fs.rmSync(iniTmp);
  fs.rmSync(lmconfTmp);
  fs.rmSync(sessionsDir, {
    recursive: true,
  });
});

describe("Main", () => {
  beforeAll((done) => {
    // load express app
    import("./__testData__/express-app.js")
      .then((mod) => {
        mod.default
          .then((res) => {
            app = res;
            done();
          })
          .catch((e) => {
            done(e);
          });
      })
      .catch((e) => {
        done(e);
      });
  });
  test("It should redirect unauthentified requests", (done) => {
    request(app)
      .get("/")
      .then((response) => {
        expect(response.status).toEqual(302);
        expect(response.headers.location).toMatch(
          new RegExp("^http://auth.example.com/\\?url="),
        );
        done();
      });
  });

  test("It should redirect unexistent sessions", (done) => {
    agent("bar", "/deny")
      .expect(302)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.headers.location).toMatch(
          new RegExp("^http://auth.example.com/\\?url="),
        );
        done();
      });
  });

  test("It should accept authentified requests", (done) => {
    agent()
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.text).toEqual("Hello World!");
        done();
      });
  });

  test("It should reject /deny", (done) => {
    agent("dwho", "/deny")
      .expect(403)
      .end((err) => {
        if (err) return done(err);
        done();
      });
  });

  test("It should accept /dwho for dwho", (done) => {
    agent("dwho", "/dwho")
      .expect(200)
      .end((err) => {
        if (err) return done(err);
        done();
      });
  });

  test("It should deny /dwho for rtyler", (done) => {
    agent("rtyler", "/dwho")
      .expect(403)
      .end((err) => {
        if (err) return done(err);
        done();
      });
  });

  test("It should send headers and remove cookie", (done) => {
    agent("dwho", "/headers")
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        let headers = JSON.parse(res.text);
        expect(headers["Auth-User"]).toEqual("dwho");
        expect(headers["cookie"]).toEqual("");
        done();
      });
  });

  it("Should return an error if host isn't configured", (done) => {
    agent("dwho", "/", "test3.example.com")
      .expect(503)
      .end((err) => {
        if (err) return done(err);
        done();
      });
  });
});

describe("handlerServiceToken", () => {
  beforeEach((done) => {
    const mod = require("./__testData__/express-app-st.js");
    mod
      .then((res) => {
        app = res;
        done();
      })
      .catch((e) => {
        throw new Error(e);
      });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should works with user", (done) => {
    agent("dwho", "/headers")
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        let headers = JSON.parse(res.text);
        expect(headers["Auth-User"]).toEqual("dwho");
        expect(headers["cookie"]).toEqual("");
        done();
      });
  });

  it("should accept valid token", (done) => {
    agentSt(cipher.token("dwhosession", "test1.example.com"), "/headers")
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        let headers = JSON.parse(res.text);
        expect(headers["Auth-User"]).toEqual("dwho");
        done();
      });
  });

  describe("errors", () => {
    it("should reject invalid token", (done) => {
      agentSt(
        [
          parseInt(Math.trunc(Date.now() / 1000)),
          "dwhosession",
          "test1.example.com",
        ].join(":"),
        "/headers",
      )
        .expect(302)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.headers.location).toMatch(
            new RegExp("^http://auth.example.com/\\?url="),
          );
          expect(errorSpy).toHaveBeenCalledWith("Invalid token");
          done();
        });
    });

    it("should reject expired token", (done) => {
      agentSt(
        crypto.encrypt(
          [
            parseInt(Math.trunc(Date.now() / 1000) - 31),
            "dwhosession",
            "test1.example.com",
          ].join(":"),
        ),
        "/headers",
      )
        .expect(302)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.headers.location).toMatch(
            new RegExp("^http://auth.example.com/\\?url="),
          );
          expect(warnSpy).toHaveBeenCalledWith("Expired service token");
          done();
        });
    });
  });
});

const agent = (id = "dwho", path = "/", host = "test1.example.com") => {
  return request
    .agent(app)
    .host(host)
    .get(path)
    .set("Cookie", [`lemonldap=${id}session`])
    .send();
};

const agentSt = (token, path = "/", host = "test1.example.com") => {
  return request
    .agent(app)
    .host(host)
    .get(path)
    .set({
      "X-Llng-Token": token,
    })
    .send();
};
