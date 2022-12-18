const createSpecies = async ({ name, desc, uuid }, trx) => {
  const speciesToCreate = {
    id: uuid,
    scientific_name: name,
    description: desc,
	  morphology: 'unknown',
  };

  await trx
    .insert(speciesToCreate)
    .into('herbarium.species')
    .onConflict('id')
    .ignore();
};

module.exports = createSpecies;
