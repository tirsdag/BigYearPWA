import { openDB } from 'idb'

const DB_NAME = 'bigyear'
const DB_VERSION = 2

export function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      const expectedKeyPaths = {
        species: 'speciesId',
        dimensions: 'DimensionId',
        lists: 'ListId',
        entries: 'EntryId',
      }

      // If a previous run created stores with different keyPaths,
      // puts will fail with: "Evaluating the object store's key path did not yield a value".
      // We reset all stores in that case (species/dimensions can be reloaded; user data is early-stage).
      let needsReset = false
      if (transaction && oldVersion > 0) {
        for (const [storeName, expectedKeyPath] of Object.entries(expectedKeyPaths)) {
          if (!db.objectStoreNames.contains(storeName)) continue
          const store = transaction.objectStore(storeName)
          const keyPath = typeof store.keyPath === 'string' ? store.keyPath : null
          if (keyPath !== expectedKeyPath) {
            needsReset = true
            break
          }
        }
      }

      if (needsReset) {
        for (const storeName of Object.keys(expectedKeyPaths)) {
          if (db.objectStoreNames.contains(storeName)) {
            db.deleteObjectStore(storeName)
          }
        }
      }

      if (!db.objectStoreNames.contains('species')) {
        const store = db.createObjectStore('species', { keyPath: 'speciesId' })
        store.createIndex('by-class', 'speciesClass')
        store.createIndex('by-sortCodeInt', 'sortCodeInt')
      }

      if (!db.objectStoreNames.contains('dimensions')) {
        db.createObjectStore('dimensions', { keyPath: 'DimensionId' })
      }

      if (!db.objectStoreNames.contains('lists')) {
        db.createObjectStore('lists', { keyPath: 'ListId' })
      }

      if (!db.objectStoreNames.contains('entries')) {
        const store = db.createObjectStore('entries', { keyPath: 'EntryId' })
        store.createIndex('by-list', 'ListId')
        store.createIndex('by-species', 'SpeciesId')
      }
    },
  })
}
