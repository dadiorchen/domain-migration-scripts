const convertStringToUuid = require('uuid-by-string');
const createGrowerAccount = require('./createGrowerAccount');

const createWalletRegistration = async (
  {
    planter,
    planter_registrations,
    tree: { planter_identifier, device_identifier, treePlanterPhoto },
  },
  trx,
) => {
  const latestRegistration = planter_registrations[0];

  const growerAccountId = await createGrowerAccount(
    { planter, planter_registrations, treePlanterPhoto, planter_identifier },
    trx,
  );

  const walletRegistrationId = convertStringToUuid(
    device_identifier + planter_identifier,
  );

  // check if walletRegistrationId already exists
  const existingWalletRegistration = await trx
    .select()
    .table('field_data.wallet_registration')
    .where('id', walletRegistrationId)
    .first();

  if (Object.keys(existingWalletRegistration).length) {
    return {
      walletRegistrationId,
      organization: existingWalletRegistration.v1_legacy_organization,
      growerAccountId,
    };
  }

  const walletRegistrationToCreate = Object.freeze({
    id: walletRegistrationId,
    wallet: planter_identifier,
    user_photo_url:
      planter.image_url ||
      treePlanterPhoto ||
      'https://greenstand.org/fileadmin/02-graphics/12-externally-linked/no-planter-image.png',
    grower_account_id: growerAccountId,
    first_name: latestRegistration.first_name,
    last_name: latestRegistration.last_name,
    phone: latestRegistration.phone,
    email: latestRegistration.email,
    lat: latestRegistration.lat,
    lon: latestRegistration.lon,
    registered_at: latestRegistration.created_at,
    v1_legacy_organization: latestRegistration.organization, // get this from the planter table?? organizaton or organization_id?? or planting_organization_id
  });

  // or migrate all planter registrations over???

  await trx()
    .insert(walletRegistrationToCreate)
    .into('field_data.wallet_registration');

  return {
    walletRegistrationId,
    organization: walletRegistrationToCreate.v1_legacy_organization,
    growerAccountId,
  };
};

module.exports = createWalletRegistration;
