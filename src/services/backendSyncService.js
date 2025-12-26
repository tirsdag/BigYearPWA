import { getOrCreateDeviceId } from './deviceIdService.js'
import { getAllEntries, getAllLists, replaceAllListsAndEntries } from '../repositories/listRepository.js'

function getApiBaseUrl() {
  const raw = import.meta.env.VITE_API_BASE_URL
  return raw ? String(raw).replace(/\/$/, '') : ''
}

async function fetchJson(url, { method = 'GET', body = null } = {}) {
  const deviceId = getOrCreateDeviceId()
  const headers = {
    'X-Device-Id': deviceId,
  }

  if (body != null) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : null,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Backend ${res.status}: ${text || res.statusText}`)
  }

  // Some endpoints may return empty body.
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null
  return res.json()
}

export async function trySyncUserDataOnce() {
  const apiBase = getApiBaseUrl()
  if (!apiBase) return

  if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) return

  const url = `${apiBase}/api/v1/sync/full`

  // Load both sides.
  const [remote, localLists, localEntries] = await Promise.all([
    fetchJson(url).catch(() => ({ lists: [], entries: [] })),
    getAllLists().catch(() => []),
    getAllEntries().catch(() => []),
  ])

  const remoteLists = Array.isArray(remote?.lists) ? remote.lists : []
  const remoteEntries = Array.isArray(remote?.entries) ? remote.entries : []

  const hasLocal = (localLists?.length || 0) > 0
  const hasRemote = (remoteLists?.length || 0) > 0

  // If the device is freshly installed but backend has data, pull it.
  if (!hasLocal && hasRemote) {
    await replaceAllListsAndEntries({ lists: remoteLists, entries: remoteEntries })
    return
  }

  // Otherwise: push local to backend (replace-all strategy).
  if (hasLocal) {
    await fetchJson(url, {
      method: 'POST',
      body: {
        lists: localLists,
        entries: localEntries,
      },
    })
  }
}

let syncTimer = null
let syncInFlight = null

export function requestBackendSync() {
  const apiBase = getApiBaseUrl()
  if (!apiBase) return

  if (syncTimer) return
  syncTimer = setTimeout(() => {
    syncTimer = null

    // Avoid overlapping uploads.
    if (syncInFlight) return

    syncInFlight = trySyncUserDataOnce()
      .catch(() => {})
      .finally(() => {
        syncInFlight = null
      })
  }, 2000)
}
