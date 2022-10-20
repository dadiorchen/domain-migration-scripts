require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');

const ws = Writable({ objectMode: true });
const { knex } = require('../database/knex');

async function migrate() {
  const base_query_string = `SELECT * FROM stakeholder.stakeholder`;

  const rowCountResult = await knex.select(
    knex.raw(`count(1) from (${base_query_string}) as src`),
  );
  console.log(`Migrating ${+rowCountResult[0].count} records`);

  const bar = new ProgressBar('Migrating [:bar] :percent :etas', {
    width: 100,
    total: +rowCountResult[0].count,
  });

  const trx = await knex.transaction();

  ws._write = async (stakeholder, enc, next) => {
    try {
      const entity = await trx
        .select()
        .table('public.entity')
        .where('stakeholder_uuid', stakeholder.id)
        .first();

      if (entity) {
        await trx('stakeholder.stakeholder')
          .where({ id: stakeholder.id })
          .update({
            entity_id: entity.id,
          });
      }

      bar.tick();
      if (bar.complete) {
        await trx.commit();
        console.log('Migration Complete');
        process.exit();
      }
    } catch (e) {
      console.log(e);
      console.log(`Error processing stakeholder id ${stakeholder.id} ${e}`);
      await trx.rollback();
      process.exit(1);
    }
    next();
  };

  const query_stream = knex.raw(`${base_query_string}`).stream();
  query_stream.pipe(ws);
}

migrate();
