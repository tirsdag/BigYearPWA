import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppState } from './appState.js'
import { getList, getListEntries, toggleEntrySeen } from '../services/listService.js'
import { getSpeciesById } from '../repositories/speciesRepository.js'
import { getTopProbableUnseenEntriesThisWeek } from '../services/probableSpeciesService.js'

export default function ListDetailPage() {
  const { listId } = useParams()
  const { setActiveListId } = useAppState()

  const [list, setList] = useState(null)
  const [entries, setEntries] = useState([])
  const [speciesById, setSpeciesById] = useState(new Map())

  const [probableWeek, setProbableWeek] = useState(null)
  const [probableItems, setProbableItems] = useState([])
  const [probableLoading, setProbableLoading] = useState(false)
  const [probableError, setProbableError] = useState('')

  async function refresh() {
    const [l, e] = await Promise.all([getList(listId), getListEntries(listId)])
    setList(l)
    setEntries(e)

    const uniqueIds = Array.from(new Set(e.map((x) => x.SpeciesId)))
    const refs = await Promise.all(uniqueIds.map((id) => getSpeciesById(id)))
    const map = new Map(uniqueIds.map((id, idx) => [id, refs[idx]]))
    setSpeciesById(map)

    setProbableLoading(true)
    setProbableError('')
    try {
      const { week, items } = await getTopProbableUnseenEntriesThisWeek({ listId, limit: 50 })
      setProbableWeek(week)
      setProbableItems(items)
    } catch (err) {
      setProbableItems([])
      setProbableWeek(null)
      setProbableError(String(err?.message || err))
    } finally {
      setProbableLoading(false)
    }
  }

  useEffect(() => {
    if (!listId) return
    setActiveListId(listId)
    refresh().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId])

  const sorted = useMemo(() => {
    return entries
      .slice()
      .sort((a, b) => {
        const sa = speciesById.get(a.SpeciesId)
        const sb = speciesById.get(b.SpeciesId)
        return (sa?.sortCodeInt ?? 0) - (sb?.sortCodeInt ?? 0)
      })
  }, [entries, speciesById])

  async function onToggle(entry) {
    const updated = await toggleEntrySeen(entry, !entry.Seen)
    setEntries((prev) => prev.map((e) => (e.EntryId === updated.EntryId ? updated : e)))
  }

  async function markProbableSeen(item) {
    const entry = entries.find((e) => e.EntryId === item.entryId)
    if (!entry) {
      await refresh()
      return
    }

    const updated = await toggleEntrySeen(entry, true)
    setEntries((prev) => prev.map((e) => (e.EntryId === updated.EntryId ? updated : e)))
    setProbableItems((prev) => prev.filter((p) => p.entryId !== updated.EntryId))
  }

  if (!listId) return <div className="card">Missing listId.</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card">
        <div style={{ fontWeight: 600 }}>{list?.Name || 'List'}</div>
        <div className="small">{listId}</div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Probable species (this week)</div>
        <div className="small" style={{ marginBottom: 8 }}>
          {probableWeek ? `Week ${probableWeek}` : 'Week ?'} · Top 50 · Unseen only
        </div>

        {probableLoading ? (
          <div className="small">Loading…</div>
        ) : probableError ? (
          <div className="small">{probableError}</div>
        ) : probableItems.length === 0 ? (
          <div className="small">No probable unseen entries this week.</div>
        ) : (
          <ul className="list">
            {probableItems.map((item) => (
              <li key={item.entryId} style={{ marginBottom: 8 }}>
                <div className="row">
                  <button onClick={() => markProbableSeen(item)}>Mark seen</button>
                  <div style={{ flex: 1 }}>
                    <div>{item.danishName || item.speciesId}</div>
                    <div className="small">{item.latinName || ''}</div>
                    <div className="small">rScore: {item.rScore} · obs: {item.obsCount}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Entries</div>
        {sorted.length === 0 ? (
          <div className="small">No entries.</div>
        ) : (
          <ul className="list">
            {sorted.map((entry) => {
              const species = speciesById.get(entry.SpeciesId)
              return (
                <li key={entry.EntryId} style={{ marginBottom: 8 }}>
                  <div className="row">
                    <button onClick={() => onToggle(entry)}>{entry.Seen ? 'Seen' : 'Unseen'}</button>
                    <div>
                      <div>{species?.danishName || entry.SpeciesId}</div>
                      <div className="small">{species?.latinName || ''}</div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
