import { getDb } from './db.js'

export async function getAllDimensions() {
  const db = await getDb()
  return db.getAll('dimensions')
}

export async function getDimensionById(dimensionId) {
  const db = await getDb()
  return db.get('dimensions', dimensionId)
}

export async function putDimension(dimension) {
  const db = await getDb()
  await db.put('dimensions', dimension)
}

export async function putDimensionsMany(dimensions) {
  const db = await getDb()
  const tx = db.transaction('dimensions', 'readwrite')
  for (const d of dimensions) {
    tx.store.put(d)
  }
  await tx.done
}

export async function deleteDimension(dimensionId) {
  const db = await getDb()
  await db.delete('dimensions', dimensionId)
}

export async function countDimensions() {
  const db = await getDb()
  return db.count('dimensions')
}
