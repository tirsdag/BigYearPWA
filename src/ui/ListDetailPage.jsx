import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppState } from './appState.js'
import { getList, getListEntries, toggleEntrySeen } from '../services/listService.js'
import { getSpeciesById } from '../repositories/speciesRepository.js'
import { getTopProbableUnseenEntriesThisWeek } from '../services/probableSpeciesService.js'
import SpeciesName, { getSpeciesExternalLink } from './SpeciesName.jsx'
import SpeciesThumbnail from './SpeciesThumbnail.jsx'

function formatSeenAtDa(seenAt) {
  if (!seenAt) return ''
  const d = new Date(seenAt)
  if (Number.isNaN(d.getTime())) return String(seenAt)
  return d.toLocaleDateString('da-DK')
}

export default function ListDetailPage() {
  const { listId } = useParams()
  const { setActiveListId } = useAppState()

  const probableTouchRef = useRef({ x: 0, y: 0 })

  const [list, setList] = useState(null)
  const [entries, setEntries] = useState([])
  const [speciesById, setSpeciesById] = useState(new Map())

  const [probableWeek, setProbableWeek] = useState(null)
  const [probableItems, setProbableItems] = useState([])
  const [probableLoading, setProbableLoading] = useState(false)
  const [probableError, setProbableError] = useState('')
  const [probableIndex, setProbableIndex] = useState(0)

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
      setProbableIndex(0)
    } catch (err) {
      setProbableItems([])
      setProbableWeek(null)
      setProbableError(String(err?.message || err))
      setProbableIndex(0)
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
      if (sortMode === 'seenAt' || sortMode === 'seenAtOldest') {
        const ta = a?.SeenAt ? new Date(a.SeenAt).getTime() : 0
        const tb = b?.SeenAt ? new Date(b.SeenAt).getTime() : 0

        // Put entries without SeenAt last.
        if (!ta && tb) return 1
        if (ta && !tb) return -1
        if (ta && tb && tb !== ta) {
          return sortMode === 'seenAtOldest' ? ta - tb : tb - ta
        }
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
    setProbableItems((prev) => {
      const next = prev.filter((p) => p.entryId !== updated.EntryId)
      setProbableIndex((i) => Math.max(0, Math.min(i, next.length - 1)))
      return next
    })
  }

  if (!listId) return <div className="card">Mangler liste-id.</div>

  const hasProbable = probableItems.length > 0
  const focusedProbable = hasProbable ? probableItems[Math.min(probableIndex, probableItems.length - 1)] : null

  function prevProbable() {
    setProbableIndex((i) => Math.max(0, i - 1))
  }

  function nextProbable() {
    setProbableIndex((i) => Math.min(probableItems.length - 1, i + 1))
  }

  function onProbableTouchStart(e) {
    const t = e.touches?.[0]
    if (!t) return
    probableTouchRef.current = { x: t.clientX, y: t.clientY }
  }

  function onProbableTouchEnd(e) {
    const t = e.changedTouches?.[0]
    if (!t) return

    const start = probableTouchRef.current
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y

    // Only treat as swipe if it's primarily horizontal.
    if (Math.abs(dx) < 40) return
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return

    if (dx < 0) nextProbable()
    else prevProbable()
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <div style={{ fontWeight: 600 }}>{list?.Name || 'Liste'}</div>
        <div className="small">{listId}</div>
      </div>

      <div className="card">
        <div className="probableHeader">
          <div style={{ fontWeight: 600 }}>Sandsynlige arter (denne uge)</div>
        </div>
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
          <div className="probableDeckWrap">
            <div
              className="probableDeck"
              onTouchStart={onProbableTouchStart}
              onTouchEnd={onProbableTouchEnd}
              role="group"
              aria-label="Sandsynlige arter"
            >
              {focusedProbable ? (
                <div className="probableDeckCard">
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <SpeciesThumbnail
                      speciesId={focusedProbable.speciesId}
                      speciesClass={focusedProbable.speciesClass}
                      alt={focusedProbable.danishName || ''}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div>
                        <SpeciesName
                          danishName={focusedProbable.danishName}
                          speciesId={focusedProbable.speciesId}
                          speciesStatus={focusedProbable.speciesStatus}
                          speciesClass={focusedProbable.speciesClass}
                        />
                      </div>
                      <div className="small">{focusedProbable.latinName || ''}</div>
                      <div className="small">
                        Score: {focusedProbable.rScore} · Observationer: {focusedProbable.obsCount}
                      </div>
                      {(() => {
                        const link = getSpeciesExternalLink({
                          speciesClass: focusedProbable.speciesClass,
                          speciesId: focusedProbable.speciesId,
                        })
                        return link ? (
                          <div className="small">
                            <a className="speciesExternalLink" href={link.url} target="_blank" rel="noreferrer">
                              {link.label}
                            </a>
                          </div>
                        ) : null
                      })()}
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="seenToggleButton seenToggleButton--unseen"
                      onClick={() => markProbableSeen(focusedProbable)}
                    >
                      Set
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="probableFooterNav">
              <button type="button" onClick={prevProbable} aria-label="Forrige sandsynlige art" disabled={probableIndex <= 0}>
                Forrige
              </button>
              <button
                type="button"
                onClick={nextProbable}
                aria-label="Næste sandsynlige art"
                disabled={probableIndex >= probableItems.length - 1}
              >
                Næste
              </button>
            </div>
          </div>
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
              <option value="seenAtOldest">Set dato (ældste først)</option>
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
              const link = species
                ? getSpeciesExternalLink({ speciesClass: species.speciesClass, speciesId: species.speciesId })
                : null
              return (
                <li key={entry.EntryId} style={{ marginBottom: 12 }}>
                  <div className="entryRow">
                    <div className="entryLeft">
                      <button
                        className={`seenToggleButton ${entry.Seen ? 'seenToggleButton--seen' : 'seenToggleButton--unseen'}`}
                        onClick={() => onToggle(entry)}
                        aria-label={entry.Seen ? 'Set' : 'Ikke set'}
                      >
                        {entry.Seen ? 'Set' : '\u00A0'}
                      </button>
                      <div className="small entrySeenDate">{entry.SeenAt ? formatSeenAtDa(entry.SeenAt) : ''}</div>
                    </div>

                    <div className="entryBody">
                      <div className="entryBodyRow">
                        <SpeciesThumbnail
                          speciesId={entry.SpeciesId}
                          speciesClass={species?.speciesClass || ''}
                          alt={species?.danishName || ''}
                        />
                        <div style={{ minWidth: 0 }}>
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
                          {link ? (
                            <div className="small">
                              <a className="speciesExternalLink" href={link.url} target="_blank" rel="noreferrer">
                                {link.label}
                              </a>
                            </div>
                          ) : null}
                        </div>
                      </div>
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
