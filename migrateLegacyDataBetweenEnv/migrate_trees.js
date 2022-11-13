require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');
const Chance = require('chance');
const uuid = require('uuid');

const ws = Writable({ objectMode: true });
const { sourceDB, targetDB } = require('../database/knex');

async function migrate() {
  // modify where statement
  const base_query_string = `
    SELECT *
    FROM trees
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

  // used to track already created planters in cases where a planter has more than one tree
  const existingPlanterRecord = {};
  const existingPlanterRegistrationsRecord = {};

  ws._write = async (tree, enc, next) => {
    try {
      const planterPhotoUrl = 'https://dummyimage.com/700';
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

      let newPlanterId;
      let planterEmail;
      // check if planter has been moved
      if (existingPlanterRecord[tree.planter_id]) {
        const newPlanter = await trx
          .select('id', 'email')
          .table('public.planter')
          .where('id', existingPlanterRecord[tree.planter_id])
          .first();
        newPlanterId = newPlanter.id;
        planterEmail = newPlanter.email;
      } else {
        const planterObject = { ...planter };
        delete planterObject.id;
        const createdPlanter = await trx
          .insert(
            {
              ...planterObject,
              first_name: firstName,
              last_name: lastName,
              email,
              phone,
              image_url: planterPhotoUrl,
              person_id: null,
              organization: null,
              grower_account_uuid: null,
            },
            ['id'],
          )
          .into('planter')
          .returning('id');

        newPlanterId = createdPlanter[0];
        existingPlanterRecord[planter.id] = newPlanterId;

        const planterRegistrationsObject = [];

        for (const p of planter_registrations) {
          const pCopy = { ...p };
          delete pCopy.id;
          if (!existingPlanterRegistrationsRecord[p.id]) {
            const newLat = +tree.lat + 0.005;
            const newLon = +tree.lon + 0.005;
            planterRegistrationsObject.push({
              ...pCopy,
              first_name: firstName,
              last_name: lastName,
              email,
              phone,
              planter_id: newPlanterId,
              ...(p.organization && { organization: chance.company() }),
              lat: newLat,
              lon: newLon,
              geom: targetDB.raw(
                `ST_PointFromText('POINT(${newLon} ${newLat})', 4326)`,
              ),
            });
            existingPlanterRegistrationsRecord[p.id] = 'done';
          }
        }

        await trx
          .insert(planterRegistrationsObject)
          .into('planter_registrations')
          .onConflict('id')
          .ignore();
      }

      const treeObject = { ...tree };
      delete treeObject.id;
      delete treeObject.sequence;
      const newLat = +tree.lat + 0.005;
      const newLon = +tree.lon + 0.005;
      const createdTree = await trx
        .insert(
          {
            ...treeObject,
            lat: newLat,
            lon: newLon,
            estimated_geometric_location: targetDB.raw(
              `ST_PointFromText('POINT(${newLon} ${newLat})', 4326)`,
            ),
            planter_photo_url: planterPhotoUrl,
            planter_id: newPlanterId,
            approved: false,
            planter_identifier: planterEmail || email,
            uuid: uuid.v4(),
          },
          ['id'],
        )
        .into('trees');

      const treeAttributes = await trx
        .select('tree_id', 'key', 'value')
        .table('public.tree_attributes')
        .where('tree_id', +tree.id);

      if (treeAttributes.length) {
        await trx
          .insert(
            treeAttributes.map((t) => ({ ...t, tree_id: createdTree[0].id })),
          )
          .insert('public.tree_attributes');
      }

      bar.tick();
      if (bar.complete) {
        await trx.commit();
        console.log('Migration Complete');
        process.exit();
      }
    } catch (e) {
      console.log(e);
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
