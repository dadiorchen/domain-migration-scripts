const { v4: uuid } = require('uuid');
const { knex } = require('../../database/knex');
const noPlanterImage = require('./noPlanterImage');

const createGrowerAccount = async ({ planter, planterRegistrations }, trx) => {
  const latestRegistration = planterRegistrations[0];
  const initialRegistration =
    planterRegistrations[planterRegistrations.length - 1];
  const growerAccountId = uuid();

  if (planter.phone) {
    const existingGrowerAccountPhone = await trx
      .select()
      .table('treetracker.grower_account')
      .where('wallet', planter.phone)
      .first();

    if (existingGrowerAccountPhone) {
      if (!planter.grower_account_uuid) {
        await trx('planter').where({ id: planter.id }).update({
          grower_account_uuid: existingGrowerAccountPhone.id,
        });
      }

      if (!existingGrowerAccountPhone.reference_id) {
        await trx('treetracker.grower_account')
          .where({ id: existingGrowerAccountPhone.id })
          .update({
            reference_id: planter.id,
          });
      }

      return {
        id: existingGrowerAccountPhone.id,
        wallet: existingGrowerAccountPhone.wallet,
        alreadyExists: true,
      };
    }
  }

  if (planter.email) {
    const existingGrowerAccountEmail = await trx
      .select()
      .table('treetracker.grower_account')
      .where('wallet', planter.email)
      .first();

    if (existingGrowerAccountEmail) {
      if (!planter.grower_account_uuid) {
        await trx('planter').where({ id: planter.id }).update({
          grower_account_uuid: existingGrowerAccountEmail.id,
        });
      }

      if (!existingGrowerAccountEmail.reference_id) {
        await trx('treetracker.grower_account')
          .where({ id: existingGrowerAccountEmail.id })
          .update({
            reference_id: planter.id,
          });
      }

      return {
        id: existingGrowerAccountEmail.id,
        wallet: existingGrowerAccountEmail.wallet,
        alreadyExists: true,
      };
    }
  }

  let organization_id = null;
  if (planter.organization_id) {
    const org = await trx
      .select()
      .table('entity')
      .where({ id: planter.organization_id })
      .first();

    organization_id = org.stakeholder_uuid;
  }

  const lat = latestRegistration?.lat || 0;
  const lon = latestRegistration?.lon || 0;

  const growerAccountToCreate = {
    id: growerAccountId,
    reference_id: planter.id,
    wallet: planter.phone ?? planter.email,
    organization_id,
    first_name: planter.first_name,
    last_name: planter.last_name,
    email: planter.email,
    phone: planter.phone,
    image_url: planter.image_url || noPlanterImage,
    image_rotation: planter.image_rotation || 0,
    first_registration_at:
      initialRegistration?.created_at || new Date().toISOString(),
    lon,
    lat,
    location: knex.raw(`ST_PointFromText('POINT( ${lon} ${lat}) ', 4326)`),
    gender: planter.gender,
    about: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await trx.insert(growerAccountToCreate).into('treetracker.grower_account');
  if (organization_id) {
    await trx
      .insert({ grower_account_id: growerAccountToCreate.id, organization_id })
      .into('treetracker.grower_account_org');
  }

  await trx('planter').where({ id: planter.id }).update({
    grower_account_uuid: growerAccountId,
  });

  return { id: growerAccountId, wallet: growerAccountToCreate.wallet };
};

module.exports = createGrowerAccount;
