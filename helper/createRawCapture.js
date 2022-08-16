const createRawCapture = async (tree, treeAttributes, sessionId, trx) => {
  const extra_attributes = { entries: [] };

  let abs_step_count = null;
  let delta_step_count = null;
  let rotation_matrix = null;

  for (const { key, value } of treeAttributes) {
    if (key === 'abs_step_count') {
      abs_step_count = value;
    }

    if (key === 'delta_step_count') {
      delta_step_count = value;
    }

    if (key === 'rotation_matrix') {
      rotation_matrix = value;
    }

    extra_attributes.entries.push({
      [key]: value,
    });
  }

  const rawCapture = {
    id: tree.uuid,
    reference_id: tree.id,
    image_url: tree.image_url,
    lat: tree.lat,
    lon: tree.lon,
    gps_accuracy: tree.gps_accuracy,
    note: tree.note,
    extra_attributes: extra_attributes.entries.length ? extra_attributes : null,
    status: tree.approved
      ? 'approved'
      : tree.rejection_reason
      ? 'rejected'
      : 'unprocessed',
    rejection_reason: tree.rejection_reason,
    captured_at: tree.time_created,
    session_id: sessionId,
    abs_step_count,
    delta_step_count,
    rotation_matrix,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const existingRawCapture = await trx
    .select()
    .table('field_data.raw_capture')
    .where('reference_id', tree.id)
    .orWhere('id', tree.uuid)
    .first();

  if (Object.keys(existingRawCapture).length) {
    // check if the capture's uuid and reference_id is equal to tree.uuid/tree.id
    // if not update the uuid of the raw_capture can we afford that(primary key and all)???
    return existingRawCapture;
  }

  await trx.insert(rawCapture).into('field_data.raw_capture');

  return rawCapture;
};

module.exports = createRawCapture;
