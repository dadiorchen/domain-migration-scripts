require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');

const ws = Writable({ objectMode: true });
const { knex } = require('../database/knex');

async function migrate() {
  const base_query_string = `SELECT pr.* FROM public.region pr left join regions.region rr on pr.region_uuid = rr.id 
  where rr.id is null and pr.type_id = 2`;

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

  ws._write = async (region, enc, next) => {
    try {
      await trx
        .insert({
          id: region.region_uuid,
          //   owner_id: 'ae7faf5d-46e2-4944-a6f9-5e65986b2e03',
          // collection_id: '1042ee69-c961-4faf-bca8-0828990a7c87', // GRIDS
          name: region.name || 'unknown',
          properties: region.metadata,
          shape: region.geom,
        })
        .into('regions.region');

      bar.tick();
      if (bar.complete) {
        await trx.commit();
        console.log('Migration Complete');
        process.exit();
      }
    } catch (e) {
      console.log(e);
      console.log(`Error processing region id ${region.id} ${e}`);
      await trx.rollback();
      process.exit(1);
    }
    next();
  };

  const query_stream = knex.raw(`${base_query_string}`).stream();
  query_stream.pipe(ws);
}

migrate();
