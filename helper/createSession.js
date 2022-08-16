const createSession = async (
  { organization, walletRegistrationId, deviceConfigurationId },
  trx,
) => {
  const sessionId = walletRegistrationId;

  const sessionToCreate = {
    id: sessionId,
    device_configuration_id: deviceConfigurationId,
    originating_wallet_registration_id: walletRegistrationId,
    organization,
    // organization_id, //should this be populated ?? gotten from ??
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const existingSession = await trx
    .select()
    .table('field_data.session')
    .where('id', sessionId)
    .first();

  if (Object.keys(existingSession).length) {
    return existingSession.id;
  }

  await trx.insert(sessionToCreate).into('field_data.session');

  return sessionId;
};

module.exports = createSession;
