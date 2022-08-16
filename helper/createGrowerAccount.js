const { v4: uuid } = require('uuid');
const knex = require('knex');

const createGrowerAccount = async (
  { planter, planter_registrations, treePlanterPhoto, planter_identifier },
  trx,
) => {
  const latestRegistration = planter_registrations[0];
  const initialRegistration =
    planter_registrations[planter_registrations.length - 1];
  const growerAccountId = uuid();

  const existingGrowerAccount = await trx
    .select()
    .table('treetracker.grower_account')
    .where('wallet', planter_identifier)
    .first();

  if (Object.keys(existingGrowerAccount).length) {
    return existingGrowerAccount.id;
  }

  const growerAccountToCreate = {
    id: growerAccountId,
    wallet: planter_identifier,
    organization_id: null, // where to get this possible options, planter.organization, planter.organization_id, planter_registrations.organization
    first_name: planter.first_name,
    last_name: planter.last_name,
    email: planter.email,
    phone: planter.phone,
    image_url:
      planter.image_url ||
      treePlanterPhoto ||
      'https://greenstand.org/fileadmin/02-graphics/12-externally-linked/no-planter-image.png',
    image_rotation: planter.image_rotation,
    first_registration_at: initialRegistration.created_at,
    lon: latestRegistration.lon || 0,
    lat: latestRegistration.lat || 0,
    location: knex.raw(
      `ST_PointFromText('POINT( ${latestRegistration.lon} ${latestRegistration.lat}) ', 4326)`,
    ),
    gender: planter.gender,
    about: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // grower_account_org table ???

  await trx().insert(growerAccountToCreate).into('treetracker.grower_account');

  await trx('planter').where({ id: planter.id }).update({
    grower_account_uuid: growerAccountId,
  });

  return growerAccountId;
};

module.exports = createGrowerAccount;
