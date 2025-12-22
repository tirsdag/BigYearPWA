import { fetchWeekStat } from '../repositories/assetsRepository.js'
import { getEntriesForList } from '../repositories/listRepository.js'
import { getSpeciesById } from '../repositories/speciesRepository.js'
import { getISOWeek } from '../utils/isoWeek.js'

const SPECIES_CLASSES = ['Amphibia', 'Aves', 'Insecta', 'Mammalia', 'Reptilia']

export async function getProbableSpeciesThisWeek({ listId, speciesClass }) {
  if (!listId) throw new Error('Der kræves en aktiv liste')
  if (!speciesClass) throw new Error('Artsklasse er påkrævet')

  const { week } = getISOWeek(new Date())

  const [stats, entries] = await Promise.all([
    fetchWeekStat(speciesClass, week),
    getEntriesForList(listId),
  ])

  const speciesIdSet = new Set(entries.map((e) => String(e.SpeciesId)))

  const matchedStats = (stats?.species || []).filter((s) => speciesIdSet.has(String(s.speciesid)))
  const matchedIds = matchedStats.map((s) => String(s.speciesid))
  const refs = await Promise.all(matchedIds.map((id) => getSpeciesById(id)))

  const matched = matchedStats.map((s, idx) => {
    const speciesId = String(s.speciesid)
    const ref = refs[idx]
    return {
      speciesId,
      rScore: s.rScore ?? 0,
      obsCount: s.obsCount ?? 0,
      danishName: ref?.danishName ?? s.DanishName ?? '',
      englishName: ref?.englishName ?? '',
      latinName: ref?.latinName ?? '',
    }
  })

  matched.sort((a, b) => {
    const obsDiff = (b.obsCount ?? 0) - (a.obsCount ?? 0)
    if (obsDiff !== 0) return obsDiff
    if (b.rScore !== a.rScore) return b.rScore - a.rScore
    return String(a.speciesId).localeCompare(String(b.speciesId))
  })

  return { week, items: matched }
}

export async function getProbableSpeciesThisWeekForClass({ speciesClass, limit }) {
  if (!speciesClass) throw new Error('Artsklasse er påkrævet')

  const { week } = getISOWeek(new Date())
  const stats = await fetchWeekStat(speciesClass, week)

  const itemsRaw = (stats?.species || [])
    .map((s) => ({
      speciesId: String(s.speciesid),
      rScore: s.rScore ?? 0,
      obsCount: s.obsCount ?? 0,
      danishName: s.DanishName ?? '',
    }))
    .sort((a, b) => {
      const obsDiff = (b.obsCount ?? 0) - (a.obsCount ?? 0)
      if (obsDiff !== 0) return obsDiff
      if (b.rScore !== a.rScore) return b.rScore - a.rScore
      return String(a.speciesId).localeCompare(String(b.speciesId))
    })

  const limited = typeof limit === 'number' ? itemsRaw.slice(0, Math.max(0, limit)) : itemsRaw
  const refs = await Promise.all(limited.map((x) => getSpeciesById(x.speciesId)))

  const items = limited.map((x, idx) => {
    const ref = refs[idx]
    return {
      speciesId: x.speciesId,
      rScore: x.rScore,
      obsCount: x.obsCount,
      danishName: ref?.danishName ?? x.danishName ?? '',
      englishName: ref?.englishName ?? '',
      latinName: ref?.latinName ?? '',
    }
  })

  return { week, items }
}

export async function getTopProbableUnseenEntriesThisWeek({ listId, limit = 50 }) {
  if (!listId) throw new Error('Der kræves en aktiv liste')

  const { week } = getISOWeek(new Date())
  const entries = await getEntriesForList(listId)

  const unseenEntriesBySpeciesId = new Map()
  for (const e of entries) {
    if (e?.Seen) continue
    unseenEntriesBySpeciesId.set(String(e.SpeciesId), e)
  }

  if (unseenEntriesBySpeciesId.size === 0) {
    return { week, items: [] }
  }

  const statsByClass = await Promise.all(SPECIES_CLASSES.map((cls) => fetchWeekStat(cls, week)))

  const matchedStats = []
  for (let i = 0; i < SPECIES_CLASSES.length; i++) {
    const stats = statsByClass[i]
    for (const s of stats?.species || []) {
      const speciesId = String(s.speciesid)
      const entry = unseenEntriesBySpeciesId.get(speciesId)
      if (!entry) continue
      matchedStats.push({
        entry,
        speciesId,
        rScore: s.rScore ?? 0,
        obsCount: s.obsCount ?? 0,
      })
    }
  }

  matchedStats.sort((a, b) => {
    const obsDiff = (b.obsCount ?? 0) - (a.obsCount ?? 0)
    if (obsDiff !== 0) return obsDiff
    if (b.rScore !== a.rScore) return b.rScore - a.rScore
    return String(a.speciesId).localeCompare(String(b.speciesId))
  })

  const top = matchedStats.slice(0, limit)
  const refs = await Promise.all(top.map((x) => getSpeciesById(x.speciesId)))

  const items = top.map((x, idx) => {
    const ref = refs[idx]
    return {
      entryId: x.entry.EntryId,
      speciesId: x.speciesId,
      rScore: x.rScore,
      obsCount: x.obsCount,
      danishName: ref?.danishName ?? '',
      englishName: ref?.englishName ?? '',
      latinName: ref?.latinName ?? '',
    }
  })

  return { week, items }
}
