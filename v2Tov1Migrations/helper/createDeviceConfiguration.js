const convertStringToUuid = require('uuid-by-string');

const createDeviceConfiguration = async (device, trx) => {
  const device_identifier = device?.android_id || 'unknown';
  const deviceConfigToCreate = {
    id: convertStringToUuid(device_identifier),
    device_identifier,
    app_version: device?.app_version || 'unknown',
    app_build: device?.app_build || 'unknown',
    manufacturer: device?.manufacturer || 'unknown',
    brand: device?.brand || 'unknown',
    model: device?.model || 'unknown',
    hardware: device?.hardware || 'unknown',
    device: device?.device || 'unknown',
    serial: device?.serial || 'unknown',
    os_version: device?.android_release || 'unknown',
    sdk_version: device?.android_sdk || 'unknown',
    logged_at: new Date().toISOString(),
    created_at: device?.created_at || new Date().toISOString(),
  };

  const existingDeviceConfig = await trx
    .select()
    .table('field_data.device_configuration')
    .where('id', deviceConfigToCreate.id)
    .first();

  if (existingDeviceConfig) {
    return existingDeviceConfig.id;
  }

  await trx
    .insert(deviceConfigToCreate)
    .into('field_data.device_configuration');

  return deviceConfigToCreate.id;
};

module.exports = createDeviceConfiguration;
