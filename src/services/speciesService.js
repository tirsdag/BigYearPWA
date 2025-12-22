import { getAllSpecies, getSpeciesByClass } from '../repositories/speciesRepository.js'

export async function listSpecies({ speciesClass = '' } = {}) {
  const list = speciesClass ? await getSpeciesByClass(speciesClass) : await getAllSpecies()

  return list
    .slice()
    .sort((a, b) => {
      const sc = (a.sortCodeInt ?? 0) - (b.sortCodeInt ?? 0)
      if (sc !== 0) return sc
      return String(a.danishName || '').localeCompare(String(b.danishName || ''))
    })
}
