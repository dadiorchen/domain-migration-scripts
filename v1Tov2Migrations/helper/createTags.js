const createTags = async ({ tag_name, public, uuid }, trx) => {
  const tagToCreate = {
    id: uuid,
    name: tag_name,
    isPublic: public,
  };

  await trx
    .insert(tagToCreate)
    .into('treetracker.tag')
    .onConflict('id')
    .ignore();
};

module.exports = createTags;
