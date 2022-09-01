const expect = require('expect-runtime');

const connection = process.env.DATABASE_URL;
expect(connection).to.match(/^postgresql:\//);

const knexConfig = {
  client: 'pg',
  debug: process.env.NODE_LOG_LEVEL === 'debug',
  connection,
  pool: { min: 0, max: 10 },
};

const knex = require('knex')(knexConfig);

const sourceDB = require('knex')({
  ...knexConfig,
  connection: process.env.SOURCE_DB,
});

const targetDB = require('knex')({
  ...knexConfig,
  connection: process.env.TARGET_DB,
});

module.exports = { knex, sourceDB, targetDB };
