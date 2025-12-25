import {
  deleteList,
  getAllLists,
  getEntryById,
  getEntriesForList,
  getListById,
  putEntriesForList,
  putEntry,
  putList,
} from '../repositories/listRepository.js'
import { getSpeciesByClass } from '../repositories/speciesRepository.js'
import { newId } from '../utils/id.js'

export const SPECIES_CLASSES = ['Amphibia', 'Aves', 'Insecta', 'Mammalia', 'Reptilia']

export async function listLists() {
  const lists = await getAllLists()
  return lists.slice().sort((a, b) => String(b.CreatedAt).localeCompare(String(a.CreatedAt)))
}

export async function getList(listId) {
  return getListById(listId)
}

export async function getListEntries(listId) {
  return getEntriesForList(listId)
}

export async function createList({ name, dimensionId, speciesClasses }) {
  if (!dimensionId) throw new Error('Dimension er påkrævet')
  if (!speciesClasses || speciesClasses.length === 0) throw new Error('Vælg 1+ artsklasser')

  const ListId = newId()
  const list = {
    ListId,
    Name: name || `Liste-${new Date().getFullYear()}`,
    CreatedAt: new Date().toISOString(),
    DimensionId: dimensionId,
    Entries: [],
  }

  const entries = []
  for (const cls of speciesClasses) {
    const species = await getSpeciesByClass(cls)
    for (const s of species) {
      entries.push({
        EntryId: newId(),
        SpeciesId: s.speciesId,
        Seen: false,
        SeenAt: null,
        ReferenceLink: null,
        Comment: null,
      })
    }
  }

  await putList(list)
  await putEntriesForList(ListId, entries)

  return list
}

export async function toggleEntrySeen(entry, seen) {
  const next = {
    ...entry,
    Seen: Boolean(seen),
    SeenAt: seen ? new Date().toISOString() : null,
  }

  await putEntry(next)
  return next
}

export async function toggleEntrySeenById(entryId, seen) {
  if (!entryId) throw new Error('EntryId er påkrævet')
  const entry = await getEntryById(entryId)
  if (!entry) throw new Error('Entry blev ikke fundet')
  return toggleEntrySeen(entry, seen)
}

export async function removeList(listId) {
  await deleteList(listId)
}
