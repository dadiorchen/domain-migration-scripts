const createSession = async (
  { organization, walletRegistrationId, deviceConfigurationId, organizationId },
  trx,
) => {
  const sessionId = walletRegistrationId;

  let plantingOrganizationId = null;

  if (organizationId) {
    const org = await trx
      .select()
      .table('public.entity')
      .where({ id: organizationId })
      .first();

    plantingOrganizationId = org.stakeholder_uuid;
  }

  const sessionToCreate = {
    id: sessionId,
    device_configuration_id: deviceConfigurationId,
    originating_wallet_registration_id: walletRegistrationId,
    organization,
    organization_id: plantingOrganizationId,
    created_at: new Date().toISOString(),
  };

  const existingSession = await trx
    .select()
    .table('field_data.session')
    .where('id', sessionId)
    .first();

  if (existingSession) {
    return existingSession.id;
  }

  await trx.insert(sessionToCreate).into('field_data.session');

  return sessionId;
};

module.exports = createSession;
