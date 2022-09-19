const knex = require('knex');

const createTreetrackerCapture = async (
  rawCapture,
  tree,
  treeAttributes,
  deviceConfigurationId,
  sessionId,
  growerAccountId,
  trx,
) => {
  const attributes = { entries: [] };
  for (const { key, value } of treeAttributes) {
    attributes.entries.push({
      [key]: value,
    });
  }

  const capture = {
    reference_id: rawCapture.reference_id,
    tree_id: null,
    image_url: rawCapture.image_url,
    lat: rawCapture.lat,
    lon: rawCapture.lon,
    estimated_geometric_location: knex.raw(
      `ST_PointFromText('POINT(${rawCapture.lon} ${rawCapture.lat})', 4326)`,
    ),
    gps_accuracy: rawCapture.gps_accuracy,
    morphology: tree.morphology,
    age: tree.age,
    note: tree.note,
    attributes: attributes.entries.length ? attributes : null,
    domain_specific_data: tree.domain_specific_data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    estimated_geographic_location: knex.raw(
      `ST_PointFromText('POINT(${rawCapture.lon} ${rawCapture.lat})', 4326)`,
    ),
    device_configuration_id: deviceConfigurationId,
    session_id: sessionId,
    status: 'active',
    grower_account_id: growerAccountId,
    planting_organization_id: null, // ??
    species_id: null,
    captured_at: rawCapture.captured_at,
  };

  const existingCapture = await trx
    .select()
    .table('treetracker.capture')
    .where('reference_id', capture.reference_id)
    .orWhere('id', tree.uuid)
    .first();

  if (existingCapture) {
    return existingCapture;
  }

  await trx.insert(capture).into('treetracker.capture');

  return capture;
};

module.exports = createTreetrackerCapture;
