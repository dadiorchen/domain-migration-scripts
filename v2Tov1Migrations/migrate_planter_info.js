require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');

const ws = Writable({ objectMode: true });
const { knex } = require('../database/knex');
const createGrowerAccount = require('./helper/createGrowerAccount');
const createWalletRegistrations = require('./helper/createWalletRegistrations');

async function migrate() {
  const base_query_string = `SELECT * FROM public.planter`;

  const rowCountResult = await knex.select(
    knex.raw(`count(1) from (${base_query_string}) as src`),
  );
  console.log(`Migrating ${+rowCountResult[0].count} records`);

  const bar = new ProgressBar('Migrating [:bar] :percent :etas', {
    width: 100,
    total: +rowCountResult[0].count,
  });

  const trx = await knex.transaction();

  ws._write = async (planter, enc, next) => {
    try {
      if (planter.grower_account_uuid) {
        bar.tick();
        if (bar.complete) {
          await trx.commit();
          console.log('Migration Complete');
          process.exit();
        }
        return next();
      }

      const planterRegistrations = await trx
        .select()
        .table('public.planter_registrations')
        .where('planter_id', planter.id)
        .orderBy('created_at', 'desc');

      const { id: growerAccountId, wallet } = await createGrowerAccount(
        {
          planter,
          planterRegistrations,
        },
        trx,
      );

      await createWalletRegistrations(
        {
          planter,
          planterRegistrations,
          growerAccountId,
          wallet,
        },
        trx,
      );

      bar.tick();
      if (bar.complete) {
        await trx.commit();
        console.log('Migration Complete');
        process.exit();
      }
    } catch (e) {
      console.log(e);
      console.log(`Error processing planter id ${planter.id} ${e}`);
      await trx.rollback();
      process.exit(1);
    }
    next();
  };

  const query_stream = knex.raw(`${base_query_string}`).stream();
  query_stream.pipe(ws);
}

migrate();
