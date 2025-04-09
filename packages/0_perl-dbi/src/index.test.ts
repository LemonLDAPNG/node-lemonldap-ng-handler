const fs = require("fs");
const knex = require("knex");
const PerlDBI = require("..");

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
