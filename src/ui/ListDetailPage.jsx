import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppState } from './appState.js'
import { getList, getListEntries, toggleEntrySeen } from '../services/listService.js'
import { getSpeciesById } from '../repositories/speciesRepository.js'
import { getTopProbableUnseenEntriesThisWeek } from '../services/probableSpeciesService.js'
import SpeciesName from './SpeciesName.jsx'

function formatSeenAtDa(seenAt) {
  if (!seenAt) return ''
  const d = new Date(seenAt)
  if (Number.isNaN(d.getTime())) return String(seenAt)
  return d.toLocaleDateString('da-DK')
}

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

  const [seenFilter, setSeenFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState('sortId')

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
    const base = entries.slice().sort((a, b) => {
      if (sortMode === 'seenAt') {
        const ta = a?.SeenAt ? new Date(a.SeenAt).getTime() : 0
        const tb = b?.SeenAt ? new Date(b.SeenAt).getTime() : 0

        // Put entries without SeenAt last.
        if (!ta && tb) return 1
        if (ta && !tb) return -1
        if (ta && tb && tb !== ta) return tb - ta
      }

      const sa = speciesById.get(a.SpeciesId)
      const sb = speciesById.get(b.SpeciesId)
      const diff = (sa?.sortCodeInt ?? 0) - (sb?.sortCodeInt ?? 0)
      if (diff !== 0) return diff
      return String(a?.SpeciesId || '').localeCompare(String(b?.SpeciesId || ''))
    })

    const q = query.trim().toLowerCase()
    const withSeen =
      seenFilter === 'seen'
        ? base.filter((e) => Boolean(e.Seen))
        : seenFilter === 'unseen'
          ? base.filter((e) => !e.Seen)
          : base

    if (!q) return withSeen

    return withSeen.filter((e) => {
      const s = speciesById.get(e.SpeciesId)
      return String(s?.danishName || '').toLowerCase().includes(q)
    })
  }, [entries, speciesById, seenFilter, query, sortMode])

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

  if (!listId) return <div className="card">Mangler liste-id.</div>

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <div style={{ fontWeight: 600 }}>{list?.Name || 'Liste'}</div>
        <div className="small">{listId}</div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Sandsynlige arter (denne uge)</div>
        <div className="small" style={{ marginBottom: 8 }}>
          {probableWeek ? `Uge ${probableWeek}` : 'Uge ?'} · Top 50 · Kun ikke sete
        </div>

        {probableLoading ? (
          <div className="small">Indlæser…</div>
        ) : probableError ? (
          <div className="small">{probableError}</div>
        ) : probableItems.length === 0 ? (
          <div className="small">Ingen sandsynlige ikke-sete arter i denne uge.</div>
        ) : (
          <ul className="list">
            {probableItems.map((item) => (
              <li key={item.entryId} style={{ marginBottom: 12 }}>
                <div className="row">
                  <button className="seenToggleButton seenToggleButton--unseen" onClick={() => markProbableSeen(item)}>
                    Set
                  </button>
                  <div style={{ flex: 1 }}>
                    <div>
                      <SpeciesName
                        danishName={item.danishName}
                        speciesId={item.speciesId}
                        speciesStatus={item.speciesStatus}
                        speciesClass={item.speciesClass}
                      />
                    </div>
                    <div className="small">{item.latinName || ''}</div>
                    <div className="small">Score: {item.rScore} · Observationer: {item.obsCount}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>Arter</div>
          <label style={{ maxWidth: 220 }}>
            Vis{' '}
            <select value={seenFilter} onChange={(e) => setSeenFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="unseen">Ikke set</option>
              <option value="seen">Set</option>
            </select>
          </label>
          <label style={{ maxWidth: 240 }}>
            Sorter{' '}
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="sortId">SortId</option>
              <option value="seenAt">Set dato (nyeste først)</option>
            </select>
          </label>
          <label style={{ maxWidth: 260 }}>
            Søg{' '}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Dansk navn…"
              inputMode="search"
            />
          </label>
        </div>
        {sorted.length === 0 ? (
          <div className="small">Ingen arter.</div>
        ) : (
          <ul className="list">
            {sorted.map((entry) => {
              const species = speciesById.get(entry.SpeciesId)
              return (
                <li key={entry.EntryId} style={{ marginBottom: 12 }}>
                  <div className="row">
                    <button
                      className={`seenToggleButton ${entry.Seen ? 'seenToggleButton--seen' : 'seenToggleButton--unseen'}`}
                      onClick={() => onToggle(entry)}
                    >
                      {entry.Seen ? 'Set' : 'Ikke set'}
                    </button>
                    <div>
                      <div>
                        {species ? (
                          <SpeciesName
                            danishName={species.danishName}
                            speciesId={species.speciesId}
                            speciesStatus={species.speciesStatus}
                            speciesClass={species.speciesClass}
                          />
                        ) : (
                          entry.SpeciesId
                        )}
                      </div>
                      <div className="small">{species?.latinName || ''}</div>
                      {entry.SeenAt ? <div className="small">Set: {formatSeenAtDa(entry.SeenAt)}</div> : null}
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
