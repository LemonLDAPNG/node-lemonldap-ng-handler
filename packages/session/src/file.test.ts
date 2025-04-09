import session from "..";
import fs from "fs";
import path from "path";

let sessionConn: session;

beforeAll(async () => {
  // @ts-ignore
  sessionConn = new session({
    storageModule: "Apache::Session::File",
    storageModuleOptions: { Directory: __dirname },
  });
  await sessionConn.ready;
});

afterAll(() => {
  fs.rmSync(path.join(__dirname, "aaaaaaaaaaaa"));
});

test("able to update session", (done) => {
  sessionConn
    // @ts-ignore
    .update({
      _session_id: "aaaaaaaaaaaa",
      f1: "field: 1",
      f2: "field: 2",
    })
    .then((res: boolean) => {
      expect(res).toBeTruthy();
      sessionConn.get("aaaaaaaaaaaa").then((session) => {
        expect(session.f1).toEqual("field: 1");
        expect(session.f2).toEqual("field: 2");
        done();
      });
    })
    .catch((e: any) => {
      throw new Error(e);
    });
});

test("able to get session", (done) => {
  sessionConn
    .get("aaaaaaaaaaaa")
    .then((session) => {
      expect(session.f1).toEqual("field: 1");
      done();
    })
    .catch((e: any) => {
      throw new Error(e);
    });
});
