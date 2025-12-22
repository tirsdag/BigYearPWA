import { getDb } from './db.js'

export async function countSpecies() {
  const db = await getDb()
  return db.count('species')
}

export async function countSpeciesByClass(speciesClass) {
  const db = await getDb()
  return db.countFromIndex('species', 'by-class', speciesClass)
}

export async function putSpeciesMany(speciesList) {
  const db = await getDb()
  const tx = db.transaction('species', 'readwrite')
  for (const s of speciesList) {
    tx.store.put(s)
  }
  await tx.done
}

export async function replaceSpeciesByClass(speciesClass, speciesList) {
  const db = await getDb()
  const tx = db.transaction('species', 'readwrite')

  const index = tx.store.index('by-class')
  let cursor = await index.openCursor(speciesClass)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  for (const s of speciesList) {
    tx.store.put(s)
  }

  await tx.done
}

export async function getAllSpecies() {
  const db = await getDb()
  return db.getAll('species')
}

export async function getSpeciesById(speciesId) {
  const db = await getDb()
  return db.get('species', speciesId)
}

export async function getSpeciesByClass(speciesClass) {
  const db = await getDb()
  return db.getAllFromIndex('species', 'by-class', speciesClass)
}
