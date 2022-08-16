require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');

const ws = Writable({ objectMode: true });
const { knex } = require('./database/knex');
const createWalletRegistration = require('./helper/createWalletRegistration');
const createDeviceConfiguration = require('./helper/createDeviceConfiguration');
const createRawCapture = require('./helper/createRawCapture');
const createTreetrackerCapture = require('./helper/createTreetrackerCapture');
const createSession = require('./helper/createSession');

async function migrate() {
  try {
    // VALID ??
    const base_query_string = `select t.* from public.trees t left join field_data.raw_capture r on t.uuid = r.id::text 
      where r.id is null and t.active = true and (t.device_identifier is not null or t.device_id is not null) 
      and t.image_url is not null limit 1`;
    const rowCountResult = await knex.select(
      knex.raw(`count(1) from (${base_query_string}) as src`),
    );
    console.log(`Migrating ${+rowCountResult[0].count} records`);

    const bar = new ProgressBar('Migrating [:bar] :percent :etas', {
      width: 20,
      total: +rowCountResult[0].count,
    });

    const trx = await knex.transaction();
    ws._write = async (tree, enc, next) => {
      try {
        console.log('tree', tree.id);

        if (!tree.planter_identifier && !tree.planter_id) {
          // very unlikely
          throw new Error('Planter identifier does not exist for tree');
        }

        const planter = await trx
          .select()
          .table('public.planter')
          .where('id', tree.planter_id)
          .first();
        const planter_registrations = await trx
          .select()
          .table('public.planter_registrations')
          .where('planter_id', tree.planter_id)
          .orderBy('created_at', 'desc');

        let device = null;
        const planter_identifier = planter.phone ?? planter.email;
        let { device_identifier } = tree;

        if (device_identifier) {
          device = await trx
            .select()
            .table('public.devices')
            .where('android_id', device_identifier)
            .first();
        } else if (tree.device_id) {
          device = await trx
            .select()
            .table('public.devices')
            .where('id', tree.device_id)
            .first();

          device_identifier = device.android_id;
        } else {
          // get the device_info from the planter_registrations table??? pick the latest planter_registration???
          throw new Error('device not associated with tree');
        }

        // WALLET REGISTRATION
        const { walletRegistrationId, organization, growerAccountId } =
          await createWalletRegistration(
            {
              planter,
              planter_registrations,
              tree: {
                planter_identifier,
                device_identifier,
                treePlanterPhoto: tree.planter_photo_url,
              },
            },
            trx,
          );

        // DEVICE CONFIGURATION
        const deviceConfigurationId = await createDeviceConfiguration(
          device,
          trx,
        );

        // SESSION
        const sessionId = await createSession(
          {
            organization,
            walletRegistrationId,
            deviceConfigurationId,
          },
          trx,
        );

        // RAW CAPTURE
        const treeAttributes = await trx
          .select()
          .table('public.tree_attributes')
          .where('tree_id', +tree.id);

        const rawCapture = await createRawCapture(
          tree,
          treeAttributes,
          sessionId,
          trx,
        );

        // TREETRACKER.CAPTURE
        // if approved create capture in treetracker
        // how to handle tree.approved=true and rejection_reason is not null ??
        if (tree.approved && !tree.rejection_reason) {
          await createTreetrackerCapture(
            rawCapture,
            tree,
            treeAttributes,
            deviceConfigurationId,
            sessionId,
            growerAccountId,
            trx,
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

    const query_stream = knex.raw(`${base_query_string}`).stream();
    query_stream.pipe(ws);
  } catch (err) {
    console.log(err);
  }
}

migrate();
