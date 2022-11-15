require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');

const ws = Writable({ objectMode: true });
const { sourceDB, targetDB } = require('../database/knex');

async function migrate() {
  const base_query_string = `SELECT * FROM devices`;

  const rowCountResult = await sourceDB.select(
    sourceDB.raw(`count(1) from (${base_query_string}) as src`),
  );
  console.log(`Migrating ${+rowCountResult[0].count} records`);

  const bar = new ProgressBar('Migrating [:bar] :percent :etas', {
    width: 100,
    total: +rowCountResult[0].count,
  });

  const trx = await targetDB.transaction();

  ws._write = async (device, enc, next) => {
    try {
      await trx('devices').insert(device).onConflict('id').ignore();

      bar.tick();
      if (bar.complete) {
        await trx.commit();
        console.log('Migration Complete');
        process.exit();
      }
    } catch (e) {
      console.log(e);
      console.log(`Error processing device id ${device.id} ${e}`);
      await trx.rollback();
      process.exit(1);
    }
    next();
  };

  const query_stream = sourceDB.raw(`${base_query_string}`).stream();
  query_stream.pipe(ws);
}

migrate();
