const { default: PerlDBI } = require("perl-dbi");
const sessionDBI = require("..");
const fs = require("fs");

const db = `${__dirname}/db.sqlite`;
const dbiChain = `dbi:SQLite:dbname=${db}`;

const clean = () => {
  try {
    fs.unlinkSync(db);
  } catch (e) {
    console.debug(e);
  }
};

let sessionConn;

beforeAll(async () => {
  clean();

  const conn = PerlDBI({
    dbiChain,
  });
  await conn.schema.createTable("sessions", (table) => {
    table.string("id");
    table.string("a_session");
  });
  await conn
    .insert({
      id: "aaaaaaaaaaaa",
      a_session: '{"_session_id": "aaaaaaaaaaaa", "f1": "field 1"}',
    })
    .into("sessions");
  conn.destroy();
  sessionConn = new sessionDBI({ DataSource: dbiChain });
});

afterAll(() => {
  clean();
  sessionConn.db.destroy();
});

test("able to get session", (done) => {
  sessionConn
    .get("aaaaaaaaaaaa")
    .then((session) => {
      expect(session.f1).toEqual("field 1");
      done();
    })
    .catch((e) => {
      throw new Error(e);
    });
});

test("able to update session", (done) => {
  sessionConn
    .update({
      _session_id: "aaaaaaaaaaaa",
      _utime: 11,
      f1: "field: 1",
      f2: "field: 2",
    })
    .then((res) => {
      expect(res).toBeTruthy();
      sessionConn.get("aaaaaaaaaaaa").then((session) => {
        expect(session.f1).toEqual("field: 1");
        expect(session.f2).toEqual("field: 2");
        done();
      });
    })
    .catch((e) => {
      throw new Error(e);
    });
});
