import { fetchDimensionsPreset, fetchSpeciesFile } from '../repositories/assetsRepository.js'
import { replaceDimensionsMany } from '../repositories/dimensionRepository.js'
import { countSpeciesByClass, replaceSpeciesByClass } from '../repositories/speciesRepository.js'

const SPECIES_CLASSES = ['Amphibia', 'Aves', 'Insecta', 'Mammalia', 'Reptilia']

export async function bootstrapReferenceData() {
  await ensureSpeciesLoaded()
  await ensureDimensionsLoaded()
}

async function ensureSpeciesLoaded() {
  for (const cls of SPECIES_CLASSES) {
    const [existingForClass, species] = await Promise.all([
      countSpeciesByClass(cls),
      fetchSpeciesFile(cls),
    ])

    // If the store is partially populated (or reference data changed), replace the full class.
    if (existingForClass !== species.length) {
      await replaceSpeciesByClass(cls, species)
    }
  }
}

async function ensureDimensionsLoaded() {
  const dimensions = await fetchDimensionsPreset()
  await replaceDimensionsMany(dimensions)
}
