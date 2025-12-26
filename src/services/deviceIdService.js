import { newId } from '../utils/id.js'

const STORAGE_KEY = 'deviceId'

export function getOrCreateDeviceId() {
  try {
    const existing = String(localStorage.getItem(STORAGE_KEY) || '').trim()
    if (existing) return existing

    const next = newId()
    localStorage.setItem(STORAGE_KEY, next)
    return next
  } catch {
    // If localStorage is unavailable, fall back to an in-memory id.
    return newId()
  }
}
