require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');
const Chance = require('chance');

const ws = Writable({ objectMode: true });
const { sourceDB, targetDB } = require('../database/knex');

async function migrate() {
  const base_query_string = `
    SELECT *
    FROM trees
    WHERE ST_Intersects
        ( 
            estimated_geometric_location,
            ST_MakeEnvelope (
                -13.179818792268634,
                8.443390029903528,
                -13.184386594220998,
                8.440816477775206,
                4326
            )::geography('POLYGON') 
        )
    `;

  const rowCountResult = await sourceDB.select(
    sourceDB.raw(`count(1) from (${base_query_string}) as src`),
  );
  console.log(`Migrating ${+rowCountResult[0].count} records`);

  const bar = new ProgressBar('Migrating [:bar] :percent :etas', {
    width: 100,
    total: +rowCountResult[0].count,
  });
  const chance = new Chance();

  const trx = await targetDB.transaction();

  ws._write = async (tree, enc, next) => {
    try {
      const existingTree = await trx
        .select()
        .table('trees')
        .where('id', tree.id)
        .first();

      if (existingTree?.id) {
        bar.tick();
        if (bar.complete) {
          await trx.commit();
          console.log('Migration Complete');
          process.exit();
        }
        return next();
      }

      const planterPhotoUrl = chance.url({
        domain: 'https://picsum.photos',
        path: '2000',
        extensions: ['jpg'],
      });
      const firstName = chance.first();
      const lastName = chance.last();
      const email = chance.email();
      const phone = chance.phone({ formatted: false });

      const planter = await sourceDB
        .select()
        .table('public.planter')
        .where('id', tree.planter_id)
        .first();

      const planter_registrations = await sourceDB
        .select()
        .table('public.planter_registrations')
        .where('planter_id', tree.planter_id)
        .orderBy('created_at', 'desc');

      const existingPlanter = await trx
        .select()
        .table('public.planter')
        .where('id', planter.id)
        .first();

      let createdPlanter;

      if (!existingPlanter?.id) {
        createdPlanter = await trx
          .insert(
            {
              ...planter,
              first_name: firstName,
              last_name: lastName,
              email,
              phone,
            },
            ['id'],
          )
          .into('planter')
          .returning('id');
      }

      const planterRegistrationsObject = planter_registrations.map((p) => ({
        ...p,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        planter_id: existingPlanter?.id || createdPlanter[0].id,
      }));

      await trx
        .insert(planterRegistrationsObject)
        .into('planter_registrations')
        .onConflict()
        .ignore();

      const createdTree = await trx
        .insert(
          {
            ...tree,
            planter_photo_url: planterPhotoUrl,
            planter_id: existingPlanter.id || createdPlanter[0].id,
            approved: false,
            planter_identifier: email,
          },
          ['id'],
        )
        .into('trees');

      const treeAttributes = await trx
        .select('tree_id', 'key', 'value')
        .table('public.tree_attributes')
        .where('tree_id', +tree.id);

      if (treeAttributes.length) {
        await trx.insert(
          treeAttributes.map((t) => ({ ...t, tree_id: createdTree[0].id })),
        );
      }

      bar.tick();
      if (bar.complete) {
        await trx.commit();
        console.log('Migration Complete');
        process.exit();
      }
    } catch (e) {
      console.log(`Error processing tree id ${tree.id} ${e}`);
      await trx.rollback();
      process.exit(1);
    }
    next();
  };

  const query_stream = sourceDB.raw(`${base_query_string}`).stream();
  query_stream.pipe(ws);
}

migrate();
