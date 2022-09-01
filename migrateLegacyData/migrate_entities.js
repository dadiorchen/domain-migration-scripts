require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');
const Chance = require('chance');

const ws = Writable({ objectMode: true });
const { sourceDB, targetDB } = require('../database/knex');

async function migrate() {
  const base_query_string = `SELECT * FROM entity`;

  const rowCountResult = await sourceDB.select(
    sourceDB.raw(`count(1) from (${base_query_string}) as src`),
  );
  console.log(`Migrating ${+rowCountResult[0].count} records`);

  const bar = new ProgressBar('Migrating [:bar] :percent :etas', {
    width: 100,
    total: +rowCountResult[0].count,
  });

  const chance = Chance();

  const trx = await targetDB.transaction();

  ws._write = async (entity, enc, next) => {
    try {
      await trx('entity').insert({
        ...entity,
        ...(entity.name && { name: chance.name() }),
        ...(entity.first_name && { first_name: chance.first() }),
        ...(entity.last_name && { last_name: chance.last() }),
        ...(entity.email && { email: chance.email() }),
        ...(entity.website && { website: chance.url() }),
        ...(entity.wallet && { wallet: chance.string() }),
        ...(entity.password && { password: chance.string() }),
        ...(entity.salt && { salt: chance.string() }),
        ...(entity.phone && { phone: chance.phone({ formatted: false }) }),
      });

      bar.tick();
      if (bar.complete) {
        await trx.commit();
        console.log('Migration Complete');
        process.exit();
      }
    } catch (e) {
      console.log(`Error processing entity id ${entity.id} ${e}`);
      await trx.rollback();
      process.exit(1);
    }
    next();
  };

  const query_stream = sourceDB.raw(`${base_query_string}`).stream();
  query_stream.pipe(ws);
}

migrate();
