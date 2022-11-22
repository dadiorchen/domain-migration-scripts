const createTags = async ({ tag_name, public: isPublic, uuid }, trx) => {
  const tagToCreate = {
    id: uuid,
    name: tag_name,
    isPublic,
  };

  await trx
    .insert(tagToCreate)
    .into('treetracker.tag')
    .onConflict('id')
    .ignore();
};

module.exports = createTags;
