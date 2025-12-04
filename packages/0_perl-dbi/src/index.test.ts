const fs = require("fs");
const knex = require("knex");
const { default: PerlDBI, parseDbiChain } = require("..");

const db = `${__dirname}/db.sqlite`;
const dbiChain = `dbi:SQLite:dbname=${db}`;

const clean = () => {
  try {
    fs.unlinkSync(db);
  } catch (e) {
    console.debug(e);
  }
};

beforeAll(async () => {
  clean();

  const conn = new knex({
    client: "sqlite3",
    connection: {
      filename: `${__dirname}/db.sqlite`,
    },
    useNullAsDefault: true,
  });
  await conn.schema.createTable("lmconfig", function (table) {
    table.integer("cfgNum");
    table.string("data");
  });
  for (let i = 0; i < 10; i++) {
    await conn.insert({ cfgNum: i, data: "d" }).into("lmconfig");
  }
  conn.destroy();
});

afterAll(clean);

test("able to search", (done) => {
  const conn = PerlDBI({ dbiChain });
  conn
    .select("cfgNum")
    .from("lmconfig")
    .orderBy("cfgNum")
    .then((res) => {
      expect(res[0].cfgNum).toEqual(0);
      conn.destroy();
      done();
    });
});

describe("parseDbiChain", () => {
  it("should parse PostgreSQL DBI chain", () => {
    const options = parseDbiChain({
      dbiChain: "dbi:Pg:dbname=llng;host=localhost;port=5432",
      dbiUser: "testuser",
      dbiPassword: "testpass",
    });
    expect(options.type).toBe("pg");
    expect(options.database).toBe("llng");
    expect(options.host).toBe("localhost");
    expect(options.port).toBe("5432");
    expect(options.user).toBe("testuser");
    expect(options.password).toBe("testpass");
  });

  it("should parse SQLite DBI chain", () => {
    const options = parseDbiChain({
      dbiChain: "dbi:SQLite:dbname=/tmp/test.db",
    });
    expect(options.type).toBe("sqlite3");
    expect(options.database).toBe("/tmp/test.db");
  });

  it("should parse MySQL DBI chain", () => {
    const options = parseDbiChain({
      dbiChain: "dbi:mysql:database=mydb;host=dbhost;port=3306",
    });
    expect(options.type).toBe("mysql");
    expect(options.database).toBe("mydb");
    expect(options.host).toBe("dbhost");
    expect(options.port).toBe("3306");
  });
});
