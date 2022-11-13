// Migrate all legacy planter_registrations

const noPlanterImage = require('./noPlanterImage');

const createWalletRegistrations = async (
  { planter, planterRegistrations, growerAccountId, wallet },
  trx,
) => {
  const walletRegistrationsToCreate = planterRegistrations.map((p) => ({
    wallet,
    user_photo_url: planter.image_url || noPlanterImage,
    grower_account_id: growerAccountId,
    first_name: p.first_name,
    last_name: p.last_name,
    phone: p.phone,
    email: p.email,
    lat: p.lat || 0,
    lon: p.lon || 0,
    registered_at: p.created_at,
    v1_legacy_organization: p.organization,
  }));

  if (walletRegistrationsToCreate.length) {
    await trx
      .insert(walletRegistrationsToCreate)
      .into('field_data.wallet_registration');
  }
};

module.exports = createWalletRegistrations;
