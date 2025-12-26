import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppState } from './appState.js'
import { getList, getListEntries, listLists, toggleEntrySeen, toggleEntrySeenById } from '../services/listService.js'
import { getSpeciesById } from '../repositories/speciesRepository.js'
import { getTopProbableUnseenEntriesThisWeek } from '../services/probableSpeciesService.js'
import { fetchWeekStat } from '../repositories/assetsRepository.js'
import { getISOWeek, getISOWeekStartDate } from '../utils/isoWeek.js'
import { getDofKnownLocationsUrl } from '../utils/dofLinks.js'
import SpeciesName, { getSpeciesExternalLink } from './SpeciesName.jsx'
import SpeciesThumbnail from './SpeciesThumbnail.jsx'

const MAX_WEEK = 52

const ALL_SPECIES_CLASSES = ['Amphibia', 'Aves', 'Insecta', 'Mammalia', 'Reptilia']

const RARE_STATUSES = new Set(['AU', 'HU', 'BU', 'CU', 'U', 'AS'])
const EXOTIC_STATUSES = new Set(['EU', 'DU', 'E', 'D'])
const COMMON_STATUSES = new Set(['A', 'X', 'C'])

function formatWeekStartDateDa(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC']
  const d = String(date.getDate()).padStart(2, '0')
  const m = months[date.getMonth()] || ''
  return `${d}-${m}`
}

function clampWeek(w) {
  const n = Number(w)
  if (!Number.isFinite(n)) return 1
  return Math.min(MAX_WEEK, Math.max(1, Math.trunc(n)))
}

function formatSeenAtDa(seenAt) {
  if (!seenAt) return ''
  const d = new Date(seenAt)
  if (Number.isNaN(d.getTime())) return String(seenAt)
  return d.toLocaleDateString('da-DK')
}

export default function ListDetailPage() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const { setActiveListId } = useAppState()

  const currentYear = new Date().getFullYear()
  const isoYear = getISOWeek(new Date()).year

  const probableTouchRef = useRef({ x: 0, y: 0 })
  const weekStatCacheRef = useRef(new Map())

  const [list, setList] = useState(null)
  const [entries, setEntries] = useState([])
  const [speciesById, setSpeciesById] = useState(new Map())

  const [availableLists, setAvailableLists] = useState([])
  const [probableListId, setProbableListId] = useState('')
  const [selectedWeek, setSelectedWeek] = useState(() => clampWeek(getISOWeek(new Date()).week))

  const [probableWeek, setProbableWeek] = useState(null)
  const [probableItems, setProbableItems] = useState([])
  const [probableLoading, setProbableLoading] = useState(false)
  const [probableError, setProbableError] = useState('')
  const [probableIndex, setProbableIndex] = useState(0)

  const [seenFilter, setSeenFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('common')
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState('sortId')
  const [speciesViewMode, setSpeciesViewMode] = useState('list')

  const [suggestionObsCountBySpeciesId, setSuggestionObsCountBySpeciesId] = useState(() => new Map())
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState('')

  async function refreshListData() {
    const [l, e, allLists] = await Promise.all([getList(listId), getListEntries(listId), listLists()])
    setList(l)
    setEntries(e)
    setAvailableLists(allLists)

    const uniqueIds = Array.from(new Set(e.map((x) => x.SpeciesId)))
    const refs = await Promise.all(uniqueIds.map((id) => getSpeciesById(id)))
    const map = new Map(uniqueIds.map((id, idx) => [id, refs[idx]]))
    setSpeciesById(map)
  }

  useEffect(() => {
    if (!listId) return
    setActiveListId(listId)

    setProbableListId(listId)
    setSelectedWeek(clampWeek(getISOWeek(new Date()).week))
    refreshListData().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId])

  useEffect(() => {
    let cancelled = false
    if (!probableListId) return

    setProbableLoading(true)
    setProbableError('')
    getTopProbableUnseenEntriesThisWeek({ listId: probableListId, weekNumber: selectedWeek, limit: 10 })
      .then(({ week, items }) => {
        if (cancelled) return
        setProbableWeek(week)
        setProbableItems(items)
        setProbableIndex(0)
      })
      .catch((err) => {
        if (cancelled) return
        setProbableItems([])
        setProbableWeek(null)
        setProbableError(String(err?.message || err))
        setProbableIndex(0)
      })
      .finally(() => {
        if (cancelled) return
        setProbableLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [probableListId, selectedWeek])

  useEffect(() => {
    if (sortMode !== 'suggestions') return
    if (seenFilter !== 'unseen') setSeenFilter('unseen')
  }, [sortMode, seenFilter])

  useEffect(() => {
    let cancelled = false
    if (sortMode !== 'suggestions') return

    const classSet = new Set()
    for (const entry of entries) {
      const s = speciesById.get(entry.SpeciesId)
      const cls = String(s?.speciesClass || '').trim()
      if (cls) classSet.add(cls)
    }

    if (classSet.size === 0) {
      for (const cls of ALL_SPECIES_CLASSES) classSet.add(cls)
    }

    setSuggestionsLoading(true)
    setSuggestionsError('')

    ;(async () => {
      const nextMap = new Map()

      for (const cls of Array.from(classSet)) {
        const cacheKey = `${cls}-${selectedWeek}`
        let cached = weekStatCacheRef.current.get(cacheKey)

        if (!cached) {
          try {
            const json = await fetchWeekStat(cls, selectedWeek)
            const arr = Array.isArray(json?.species) ? json.species : []
            cached = arr
              .map((x) => ({ speciesId: String(x?.speciesid || ''), obsCount: Number(x?.obsCount || 0) }))
              .filter((x) => x.speciesId)
          } catch {
            cached = []
          }

          weekStatCacheRef.current.set(cacheKey, cached)
        }

        for (const row of cached) {
          const prev = nextMap.get(row.speciesId)
          const v = Number.isFinite(row.obsCount) ? row.obsCount : 0
          if (prev == null || v > prev) nextMap.set(row.speciesId, v)
        }
      }

      if (cancelled) return
      setSuggestionObsCountBySpeciesId(nextMap)
    })()
      .catch((err) => {
        if (cancelled) return
        setSuggestionObsCountBySpeciesId(new Map())
        setSuggestionsError(String(err?.message || err))
      })
      .finally(() => {
        if (cancelled) return
        setSuggestionsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sortMode, selectedWeek, entries, speciesById])

  const sorted = useMemo(() => {
    let base = entries.slice()

    if (sortMode === 'suggestions') {
      base = base.sort((a, b) => {
        const oa = suggestionObsCountBySpeciesId.get(a.SpeciesId) || 0
        const ob = suggestionObsCountBySpeciesId.get(b.SpeciesId) || 0
        if (ob !== oa) return ob - oa

        const sa = speciesById.get(a.SpeciesId)
        const sb = speciesById.get(b.SpeciesId)
        const diff = (sa?.sortCodeInt ?? 0) - (sb?.sortCodeInt ?? 0)
        if (diff !== 0) return diff
        return String(a?.SpeciesId || '').localeCompare(String(b?.SpeciesId || ''))
      })
    } else {
      base = base.sort((a, b) => {
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
    }

    const q = query.trim().toLowerCase()
    const effectiveSeenFilter = sortMode === 'suggestions' ? 'unseen' : seenFilter

    const withSeen =
      effectiveSeenFilter === 'seen'
        ? base.filter((e) => Boolean(e.Seen))
        : effectiveSeenFilter === 'unseen'
          ? base.filter((e) => !e.Seen)
          : base

    const withStatus =
      statusFilter === 'all'
        ? withSeen
        : withSeen.filter((e) => {
            const s = speciesById.get(e.SpeciesId)
            const status = String(s?.speciesStatus || '').trim().toUpperCase()
            if (!status) return false
            if (statusFilter === 'rare') return RARE_STATUSES.has(status)
            if (statusFilter === 'exotic') return EXOTIC_STATUSES.has(status)
            if (statusFilter === 'common') return COMMON_STATUSES.has(status)
            return true
          })

    if (!q) return withStatus

    return withStatus.filter((e) => {
      const s = speciesById.get(e.SpeciesId)
      return String(s?.danishName || '').toLowerCase().includes(q)
    })
  }, [entries, speciesById, seenFilter, statusFilter, query, sortMode, suggestionObsCountBySpeciesId])

  async function onToggle(entry) {
    const updated = await toggleEntrySeen(entry, !entry.Seen)
    setEntries((prev) => prev.map((e) => (e.EntryId === updated.EntryId ? updated : e)))

    if (updated?.Seen) {
      setProbableItems((prev) => {
        const next = prev.filter((p) => p.entryId !== updated.EntryId)
        setProbableIndex((i) => Math.max(0, Math.min(i, next.length - 1)))
        return next
      })
    }
  }

  async function markProbableSeen(item) {
    const updated = await toggleEntrySeenById(item.entryId, true)
    if (String(updated?.ListId || '') === String(listId)) {
      setEntries((prev) => prev.map((e) => (e.EntryId === updated.EntryId ? updated : e)))
    }
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

  function prevWeek() {
    setSelectedWeek((w) => (w <= 1 ? MAX_WEEK : w - 1))
  }

  function nextWeek() {
    setSelectedWeek((w) => (w >= MAX_WEEK ? 1 : w + 1))
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
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <select
            aria-label="Liste"
            style={{ maxWidth: 320 }}
            value={probableListId}
            onChange={(e) => {
              const next = e.target.value
              setProbableListId(next)
              navigate(`/lists/${encodeURIComponent(next)}`)
            }}
          >
            {availableLists.map((l) => (
              <option key={l.ListId} value={l.ListId}>
                {l.Name || l.ListId}
              </option>
            ))}
          </select>

          <button type="button" onClick={() => navigate('/')} aria-label="Opret ny liste">
            Opret ny liste
          </button>

          <button type="button" onClick={() => navigate('/')} aria-label="Lister">
            Lister
          </button>
        </div>
      </div>

      <div className="card">
        <div className="probableHeader">
          <div style={{ fontWeight: 600 }}>Forslag for uge ({selectedWeek})</div>
        </div>
        <div className="row" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={prevWeek} aria-label="Forrige uge">
            {'<'}
          </button>

          <select
            aria-label="Uge"
            style={{ maxWidth: 180 }}
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(clampWeek(e.target.value))}
          >
            {Array.from({ length: MAX_WEEK }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {w} ({formatWeekStartDateDa(getISOWeekStartDate(isoYear, w))})
              </option>
            ))}
          </select>

          <button type="button" onClick={nextWeek} aria-label="Næste uge">
            {'>'}
          </button>
        </div>

        {probableLoading ? (
          <div className="small">Indlæser…</div>
        ) : probableError ? (
          <div className="small">{probableError}</div>
        ) : probableItems.length === 0 ? (
          <div className="small">Ingen sandsynlige ikke-sete arter i uge {selectedWeek}.</div>
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
                    {(() => {
                      const link = getSpeciesExternalLink({
                        speciesClass: focusedProbable.speciesClass,
                        speciesId: focusedProbable.speciesId,
                      })
                      const url = getDofKnownLocationsUrl({
                        speciesId: focusedProbable.speciesId,
                        weekNumber: selectedWeek,
                        year: currentYear,
                      })
                      if (!link && !url) return null
                      return (
                        <div className="small">
                          {link ? (
                            <a className="speciesExternalLink" href={link.url} target="_blank" rel="noreferrer">
                              {link.label}
                            </a>
                          ) : null}
                          {link && url ? ' · ' : null}
                          {url ? (
                            <a className="speciesExternalLink" href={url} target="_blank" rel="noreferrer">
                              Set her
                            </a>
                          ) : null}
                        </div>
                      )
                    })()}
                  </div>

                  <div className="row" style={{ alignItems: 'flex-start', marginTop: 10 }}>
                    <div className="entryThumbCol">
                      <button
                        type="button"
                        className="seenToggleButton seenToggleButton--unseen"
                        onClick={() => markProbableSeen(focusedProbable)}
                        aria-label="Marker som set"
                      >
                        Set
                      </button>
                      <SpeciesThumbnail
                        speciesId={focusedProbable.speciesId}
                        speciesClass={focusedProbable.speciesClass}
                        alt={focusedProbable.danishName || ''}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={prevProbable}
                        aria-label="Forrige sandsynlige art"
                        disabled={probableIndex <= 0}
                      >
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

                      <button
                        type="button"
                        onClick={() => {
                          setSortMode('suggestions')
                          setSeenFilter('unseen')
                          setSpeciesViewMode('gallery')
                        }}
                        aria-label="Vis alle forslag som liste"
                      >
                        Andre forslag
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 8 }}>
          <label style={{ width: '100%' }}>
            <input
              style={{ width: '100%' }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Søg dansk navn…"
              inputMode="search"
              aria-label="Søg dansk navn"
            />
          </label>
        </div>

        <div className="row" style={{ marginBottom: 8 }}>
          <label style={{ maxWidth: 220 }}>
            Vis{' '}
            <select value={seenFilter} onChange={(e) => setSeenFilter(e.target.value)}>
              <option value="all">Alle</option>
              <option value="unseen">Ikke set</option>
              <option value="seen">Set</option>
            </select>
          </label>

          <label style={{ maxWidth: 260 }}>
            Status{' '}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="rare">sjældne (rød/grøn)</option>
              <option value="exotic">[eksotiske]</option>
              <option value="common">Almindelige</option>
            </select>
          </label>

          <label style={{ maxWidth: 240 }}>
            Sorter{' '}
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="sortId">Art</option>
              <option value="suggestions">Forslag</option>
              <option value="seenAt">Set dato (nyeste først)</option>
              <option value="seenAtOldest">Set dato (ældste først)</option>
            </select>
          </label>

          <label style={{ maxWidth: 200 }}>
            Visning{' '}
            <select value={speciesViewMode} onChange={(e) => setSpeciesViewMode(e.target.value)}>
              <option value="list">Liste</option>
              <option value="gallery">Galleri</option>
            </select>
          </label>
        </div>
        {sortMode === 'suggestions' && suggestionsLoading ? (
          <div className="small">Indlæser forslag…</div>
        ) : sortMode === 'suggestions' && suggestionsError ? (
          <div className="small">{suggestionsError}</div>
        ) : sorted.length === 0 ? (
          <div className="small">{sortMode === 'suggestions' ? `Ingen forslag i uge ${selectedWeek}.` : 'Ingen arter.'}</div>
        ) : speciesViewMode === 'gallery' ? (
          <div className="galleryGrid" aria-label="Galleri">
            {sorted.map((entry) => {
              const species = speciesById.get(entry.SpeciesId)
              return (
                <div key={entry.EntryId} className="galleryCell">
                  <div className="galleryTile">
                    <div className="galleryTile__nameAbove">{species?.danishName || entry.SpeciesId}</div>
                    <div className="galleryTile__media">
                      <button
                        type="button"
                        className={`seenToggleButton galleryTile__seenButton ${entry.Seen ? 'seenToggleButton--seen' : 'seenToggleButton--unseen'}`}
                        onClick={() => onToggle(entry)}
                        aria-label={entry.Seen ? 'Set' : 'Ikke set'}
                      >
                        {entry.Seen ? '\u00A0' : 'Set'}
                      </button>
                      <SpeciesThumbnail
                        speciesId={entry.SpeciesId}
                        speciesClass={species?.speciesClass || ''}
                        alt={species?.danishName || ''}
                        className="galleryThumb"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <ul className="list entryList">
            {sorted.map((entry) => {
              const species = speciesById.get(entry.SpeciesId)
              const link = species
                ? getSpeciesExternalLink({ speciesClass: species.speciesClass, speciesId: species.speciesId })
                : null
              const url = species
                ? getDofKnownLocationsUrl({ speciesId: species.speciesId, weekNumber: selectedWeek, year: currentYear })
                : ''
              return (
                <li key={entry.EntryId} style={{ marginBottom: 12 }}>
                  <div className="entryItem">
                    <div className="entryNameLine">
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
                      <div className="small">{species?.latinName || ''}</div>
                      {link || url ? (
                        <div className="small">
                          {link ? (
                            <a className="speciesExternalLink" href={link.url} target="_blank" rel="noreferrer">
                              {link.label}
                            </a>
                          ) : null}
                          {link && url ? ' · ' : null}
                          {url ? (
                            <a className="speciesExternalLink" href={url} target="_blank" rel="noreferrer">
                              Set her
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="entryRow">
                      <div className="entryThumbCol">
                        <button
                          className={`seenToggleButton ${entry.Seen ? 'seenToggleButton--seen' : 'seenToggleButton--unseen'}`}
                          onClick={() => onToggle(entry)}
                          aria-label={entry.Seen ? 'Set' : 'Ikke set'}
                        >
                          {entry.Seen ? '\u00A0' : 'Set'}
                        </button>
                        <div className="small entrySeenDate">{entry.SeenAt ? formatSeenAtDa(entry.SeenAt) : ''}</div>

                        <SpeciesThumbnail
                          speciesId={entry.SpeciesId}
                          speciesClass={species?.speciesClass || ''}
                          alt={species?.danishName || ''}
                        />
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
