const createStakeholders = async (entity, trx) => {
  const existingStakeholder = await trx
    .table('stakeholder.stakeholder')
    .where('id', '=', entity.stakeholder_uuid)
    .first();

  if (existingStakeholder) {
    return existingStakeholder.id;
  }

  let type = 'Person';
  if (entity.type.toLowerCase() === 'o') {
    type = 'Organization';
  }

  const stakeholder = {
    id: entity.stakeholder_uuid,
    type,
    org_name: entity.name,
    first_name: entity.first_name,
    last_name: entity.last_name,
    email: entity.email,
    phone: entity.phone,
    website: entity.website,
    logo_url: entity.logo_url,
    map: entity.map,
    entity_id: entity.id,
  };

  await trx.table('stakeholder.stakeholder').insert(stakeholder);

  const relations = await trx
    .table('entity_relationship')
    .select(
      'entity_relationship.type',
      'entity_relationship.role',
      'entity.stakeholder_uuid as child_uuid',
    )
    .where('parent_id', '=', entity.id)
    .join('entity', 'entity_relationship.child_id', '=', 'entity.id');

  await Promise.all(
    relations.map(async (relationRow) => {
      const relation = {
        parent_id: stakeholder.id,
        child_id: relationRow.child_uuid,
        type: relationRow.type,
        role: relationRow.role,
      };
      await trx.table('stakeholder.stakeholder_relation').insert(relation);
    }),
  );
  return entity.stakeholder_uuid;
};

module.exports = createStakeholders;
