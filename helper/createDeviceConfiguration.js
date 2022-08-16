const convertStringToUuid = require('uuid-by-string');

const createDeviceConfiguration = async (device, trx) => {
  const deviceConfigToCreate = {
    id: convertStringToUuid(device.device_identifier),
    device_identifier: device.android_id,
    app_version: device.app_version,
    app_build: device.app_build,
    manufacturer: device.manufacturer,
    brand: device.brand,
    model: device.model,
    hardware: device.hardware,
    device: device.device,
    serial: device.serial,
    os_version: device.android_release,
    sdk_version: device.android_sdk,
    logged_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const existingDeviceConfig = await trx
    .select()
    .table('field_data.device_configuration')
    .where('id', deviceConfigToCreate.id)
    .first();

  if (Object.keys(existingDeviceConfig).length) {
    return existingDeviceConfig.id;
  }

  await trx
    .insert(deviceConfigToCreate)
    .into('field_data.device_configuration');

  return deviceConfigToCreate.id;
};

module.exports = createDeviceConfiguration;
