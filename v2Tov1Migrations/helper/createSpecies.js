const createSpecies = async ({ name, desc, species_uuid }, trx) => {
  const speciesToCreate = {
    id: species_uuid,
    scientific_name: name,
    description: desc,
  };

  await trx
    .insert(speciesToCreate)
    .into('herbarium.species')
    .onConflict('id')
    .ignore();
};

module.exports = createSpecies;
