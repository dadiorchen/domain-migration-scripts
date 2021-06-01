const expect = require("expect-runtime");
const connection = process.env.DATABASE_URL
expect(connection).to.match(/^postgresql:\//);

let knexConfig = {
  client: "pg",
  debug: process.env.NODE_LOG_LEVEL === "debug" ? true : false,
  connection: connection,
  pool: { min: 0, max: 10 },
};

const knex = require("knex")(knexConfig);

module.exports = { knex };
