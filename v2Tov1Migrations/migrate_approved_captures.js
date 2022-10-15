require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');

const ws = Writable({ objectMode: true });
const { knex } = require('../database/knex');
const createCapture = require('./helper/createCapture');

async function migrate() {
  try {
    const base_query_string = `
        select rc.*, s.device_configuration_id, wr.grower_account_id from field_data.raw_capture rc
        join field_data.session s on rc.session_id = s.id
        join field_data.wallet_registration wr on s.originating_wallet_registration_id = wr.id
        where rc.status = 'approved';
    `;
    const rowCountResult = await knex.select(
      knex.raw(`count(1) from (${base_query_string}) as src`),
    );
    console.log(`Migrating ${+rowCountResult[0].count} records`);

    const bar = new ProgressBar('Migrating [:bar] :percent :etas', {
      width: 100,
      total: +rowCountResult[0].count,
    });

    const trx = await knex.transaction();
    ws._write = async (rawCapture, enc, next) => {
      try {
        const tree = await trx
          .select()
          .table('public.trees')
          .where('id', rawCapture.reference_id)
          .first();

        // @TODO
        // migrate tree_tags as well

        await createCapture(rawCapture, tree);

        bar.tick();
        if (bar.complete) {
          await trx.commit();
          console.log('Migration Complete');
          process.exit();
        }
      } catch (e) {
        console.log(e);
        console.log(`Error processing raw capture id ${rawCapture.id} ${e}`);
        await trx.rollback();
        process.exit(1);
      }
      next();
    };

    const query_stream = knex.raw(`${base_query_string}`).stream();
    query_stream.pipe(ws);
  } catch (err) {
    console.log(err);
  }
}

migrate();
