require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');

const ws = Writable({ objectMode: true });
const { knex } = require('../database/knex');
const createTags = require('./helper/createTags');

async function migrate() {
  const base_query_string = `SELECT pt.* FROM public.tag pt left join treetracker.tag tt
  on pt.uuid = tt.id where active = true and tt.id is null`;

  const rowCountResult = await knex.select(
    knex.raw(`count(1) from (${base_query_string}) as src`),
  );
  const recordCount = +rowCountResult[0].count;
  if (!recordCount) {
    console.log('No record left to migrate');
    process.exit(0);
  }
  console.log(`Migrating ${recordCount} records`);

  const bar = new ProgressBar('Migrating [:bar] :percent :etas', {
    width: 100,
    total: recordCount,
  });

  const trx = await knex.transaction();

  ws._write = async (tag, enc, next) => {
    try {
      await createTags(tag, trx);

      bar.tick();
      if (bar.complete) {
        await trx.commit();
        console.log('Migration Complete');
        process.exit();
      }
    } catch (e) {
      console.log(e);
      console.log(`Error processing tag id ${tag.id} ${e}`);
      await trx.rollback();
      process.exit(1);
    }
    next();
  };

  const query_stream = knex.raw(`${base_query_string}`).stream();
  query_stream.pipe(ws);
}

migrate();
