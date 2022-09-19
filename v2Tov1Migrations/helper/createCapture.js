const createCapture = async (rawCapture, tree, trx) => {
  const existingCapture = await trx
    .select()
    .table('treetracker.capture')
    .where('id', rawCapture.id)
    .first();

  if (existingCapture) {
    return existingCapture;
  }

  let plantingOrganizationId = null;

  if (tree.planting_organization_id) {
    const org = await trx
      .select()
      .table('public.entity')
      .where({ id: tree.planting_organization_id })
      .first();

    plantingOrganizationId = org.stakeholder_uuid;
  }

  let lat = rawCapture.lat;
  let lon = rawCapture.lon;

  const captureToCreate = {
    id: rawCapture.id,
    reference_id: rawCapture.reference_id,
    image_url: rawCapture.image_url,
    lat,
    lon,
    estimated_geometric_location: trx.raw(
      `ST_PointFromText('POINT(${lon} ${lat})', 4326)`,
    ),
    gps_accuracy: rawCapture.gps_accuracy,
    morphology: tree.morphology,
    // age, tree.age is a string
    note: rawCapture.note,
    attributes: rawCapture.extra_attributes,
    domain_specific_data: tree.domain_specific_data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    estimated_geographic_location: trx.raw(
      `ST_PointFromText('POINT(${lon} ${lat})', 4326)`,
    ),
    device_configuration_id: rawCapture.device_configuration_id,
    session_id: rawCapture.session_id,
    grower_account_id: rawCapture.grower_account_id,
    planting_organization_id: plantingOrganizationId,
    // species_id,
    captured_at: rawCapture.captured_at,
  };

  await trx.insert(captureToCreate).into('treetracker.capture');
};

module.exports = createCapture;
