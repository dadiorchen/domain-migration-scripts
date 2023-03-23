require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');

const ws = Writable({ objectMode: true });
const { knex } = require('../database/knex');

async function migrate() {
  const base_query_string = `
    SELECT 
      ssr.*, 
      ssp.entity_id as parent_entity_id, 
      ssc.entity_id as child_entity_id
    FROM stakeholder.stakeholder_relation ssr
    LEFT JOIN stakeholder.stakeholder ssp
        ON ssr.parent_id = ssp.id
    LEFT JOIN stakeholder.stakeholder ssc
        ON ssr.child_id = ssc.id
    LEFT JOIN entity_relationship er
        ON ssp.entity_id = er.parent_id
        AND ssc.entity_id = er.child_id
    WHERE er.id is null
  `;

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

  ws._write = async (relation, enc, next) => {
    try {
      const { parent_entity_id, child_entity_id, created_at, type, role } =
        relation;

      await trx.table('public.entity_relationship').insert({
        parent_id: parent_entity_id,
        child_id: child_entity_id,
        type: type || 'default',
        role: role || 'default',
        created_at,
      });

      bar.tick();
      if (bar.complete) {
        await trx.commit();
        console.log('Migration Complete');
        process.exit();
      }
    } catch (e) {
      console.log(e);
      console.log(
        `Error processing relation ${relation.parent_id} ${relation.child_id} ${e}`,
      );
      await trx.rollback();
      process.exit(1);
    }
    next();
  };

  const query_stream = knex.raw(`${base_query_string}`).stream();
  query_stream.pipe(ws);
}

migrate();
