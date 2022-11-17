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
        join public.trees pt on rc.id::text = pt.uuid
        left join treetracker.capture tc on rc.id = tc.id
        where 
        (
        (rc.status = 'approved' and tc.id is null) or 
        (rc.status != 'approved' and pt.active = true and pt.approved = true)
        ) AND
        ---ST_Contains((select geom from region where type_id = (select id from region_type where type = 'country') and name = 'Sierra Leone'), pt.estimated_geometric_location)
	 ST_Intersects
	   ( pt.estimated_geometric_location
	   , ST_MakeEnvelope ( -13.221380710601807-- xmin (min lng)
		    , 8.377141284746365 -- ymin (min lat)
		    , -13.238621950149538 -- xmax (max lng)
		    , 8.366823985111315 -- ymax (max lat)
		    , 4326 -- projection epsg-code
		    )
	   )
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
    ws._write = async (rawCapture, enc, next) => {
      try {
        const tree = await trx
          .select()
          .table('public.trees')
          .where('id', rawCapture.reference_id)
          .first();

        // migrate tree_tags as well
        //const treeTags = await trx.raw(
        //  `select t.uuid from public.tree_tag tt join tag t on tt.tag_id = t.id where tt.tree_id = ?`,
        //  [+tree.id],
        //);

        await createCapture(rawCapture, tree, trx, []);

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
    process.exit(1);
  }
}

migrate();
