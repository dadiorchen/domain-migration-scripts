// Creates specific wallet registration needed by the particular raw-capture being migrated

const convertStringToUuid = require('uuid-by-string');
const noPlanterImage = require('./noPlanterImage');

const createCorresspondingWalletRegistration = async (
  {
    planter,
    planter_registrations,
    tree: { planter_identifier, device_identifier },
    growerAccountId,
  },
  trx,
) => {
  const latestRegistration = planter_registrations[0];

  const walletRegistrationId = convertStringToUuid(
    device_identifier + planter_identifier,
  );

  // check if walletRegistrationId already exists
  const existingWalletRegistration = await trx
    .select()
    .table('field_data.wallet_registration')
    .where('id', walletRegistrationId)
    .first();

  if (existingWalletRegistration) {
    return {
      walletRegistrationId,
      organization: existingWalletRegistration.v1_legacy_organization,
      growerAccountId,
    };
  }

  const walletRegistrationToCreate = Object.freeze({
    id: walletRegistrationId,
    wallet: planter_identifier,
    user_photo_url: planter.image_url || noPlanterImage,
    grower_account_id: growerAccountId,
    first_name: latestRegistration.first_name,
    last_name: latestRegistration.last_name,
    phone: latestRegistration.phone,
    email: latestRegistration.email,
    lat: latestRegistration.lat,
    lon: latestRegistration.lon,
    registered_at: latestRegistration.created_at,
    v1_legacy_organization: latestRegistration.organization,
  });

  await trx
    .insert(walletRegistrationToCreate)
    .into('field_data.wallet_registration');

  return {
    walletRegistrationId,
    organization: walletRegistrationToCreate.v1_legacy_organization,
  };
};

module.exports = createCorresspondingWalletRegistration;
