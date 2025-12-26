import { getDb } from './db.js'

export async function getAllLists() {
  const db = await getDb()
  return db.getAll('lists')
}

export async function getListById(listId) {
  const db = await getDb()
  return db.get('lists', listId)
}

export async function putList(list) {
  const db = await getDb()
  await db.put('lists', list)
}

export async function deleteList(listId) {
  const db = await getDb()

  // Delete entries first.
  const tx = db.transaction(['entries', 'lists'], 'readwrite')
  const index = tx.objectStore('entries').index('by-list')
  const keys = await index.getAllKeys(listId)
  for (const k of keys) {
    tx.objectStore('entries').delete(k)
  }
  tx.objectStore('lists').delete(listId)
  await tx.done
}

export async function putEntriesForList(listId, entries) {
  const db = await getDb()
  const tx = db.transaction('entries', 'readwrite')
  for (const entry of entries) {
    tx.store.put({ ...entry, ListId: listId })
  }
  await tx.done
}

export async function getEntriesForList(listId) {
  const db = await getDb()
  return db.getAllFromIndex('entries', 'by-list', listId)
}

export async function getEntryById(entryId) {
  const db = await getDb()
  return db.get('entries', entryId)
}

export async function putEntry(entry) {
  const db = await getDb()
  await db.put('entries', entry)
}

export async function getAllEntries() {
  const db = await getDb()
  return db.getAll('entries')
}

export async function replaceAllListsAndEntries({ lists, entries }) {
  const db = await getDb()
  const tx = db.transaction(['entries', 'lists'], 'readwrite')

  await tx.objectStore('entries').clear()
  await tx.objectStore('lists').clear()

  for (const l of lists || []) {
    tx.objectStore('lists').put(l)
  }

  for (const e of entries || []) {
    tx.objectStore('entries').put(e)
  }

  await tx.done
}
