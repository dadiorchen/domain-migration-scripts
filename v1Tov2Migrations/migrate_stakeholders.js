require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');

const ws = Writable({ objectMode: true });
const { knex } = require('../database/knex');
const createStakeholders = require('./helper/createStakeholders');

async function migrate() {
  // delete_stakeholders to account for updates made on the entity tables
  const deleteStakeholdersQuery = `
      DELETE FROM stakeholder.stakeholder_relation;
      DELETE FROM stakeholder.stakeholder;
  `;

  await knex.raw(`${deleteStakeholdersQuery}`);

  console.log(`Stakeholder records deleted`);

  const base_query_string = `SELECT pe.* FROM public.entity pe left join stakeholder.stakeholder s
   on pe.stakeholder_uuid = s.id where s.id is null`;

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

  ws._write = async (entity, enc, next) => {
    try {
      await createStakeholders(entity, trx);

      bar.tick();
      if (bar.complete) {
        await trx.commit();
        console.log('Migration Complete');
        process.exit();
      }
    } catch (e) {
      console.log(e);
      console.log(`Error processing entity id ${entity.id} ${e}`);
      await trx.rollback();
      process.exit(1);
    }
    next();
  };

  const query_stream = knex.raw(`${base_query_string}`).stream();
  query_stream.pipe(ws);
}

migrate();
