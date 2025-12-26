import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAppState } from './appState.js'
import { listLists, toggleEntrySeenById } from '../services/listService.js'
import { getTopProbableUnseenEntriesThisWeek } from '../services/probableSpeciesService.js'
import { getISOWeek, getISOWeekStartDate } from '../utils/isoWeek.js'
import { getDofKnownLocationsUrl } from '../utils/dofLinks.js'
import SpeciesName, { getSpeciesExternalLink } from './SpeciesName.jsx'
import SpeciesThumbnail from './SpeciesThumbnail.jsx'

const MAX_WEEK = 52

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

export default function ProbableListPage() {
  const location = useLocation()
  const { activeListId } = useAppState()

  const currentYear = new Date().getFullYear()
  const isoYear = getISOWeek(new Date()).year

  const search = useMemo(() => new URLSearchParams(location.search || ''), [location.search])
  const initialListId = String(search.get('listId') || activeListId || '').trim()
  const initialWeek = clampWeek(search.get('week') || getISOWeek(new Date()).week)

  const [availableLists, setAvailableLists] = useState([])
  const [selectedListId, setSelectedListId] = useState(initialListId)
  const [selectedWeek, setSelectedWeek] = useState(initialWeek)
  const [viewMode, setViewMode] = useState('list')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])

  function prevWeek() {
    setSelectedWeek((w) => (w <= 1 ? MAX_WEEK : w - 1))
  }

  function nextWeek() {
    setSelectedWeek((w) => (w >= MAX_WEEK ? 1 : w + 1))
  }

  async function markSeen(entryId) {
    if (!entryId) return
    try {
      await toggleEntrySeenById(entryId, true)
      setItems((prev) => prev.filter((x) => x.entryId !== entryId))
    } catch (err) {
      setError(String(err?.message || err))
    }
  }

  useEffect(() => {
    let cancelled = false

    listLists()
      .then((lists) => {
        if (cancelled) return
        setAvailableLists(lists)

        if (!selectedListId) {
          const desired = activeListId && lists.some((l) => l.ListId === activeListId) ? activeListId : ''
          const fallback = lists[0]?.ListId || ''
          setSelectedListId(desired || fallback)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!selectedListId) return

    setLoading(true)
    setError('')
    getTopProbableUnseenEntriesThisWeek({ listId: selectedListId, weekNumber: selectedWeek })
      .then(({ items: next }) => {
        if (cancelled) return
        setItems(next)
      })
      .catch((err) => {
        if (cancelled) return
        setItems([])
        setError(String(err?.message || err))
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedListId, selectedWeek])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Sandsynlige arter (liste)</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <select
            aria-label="Liste"
            style={{ maxWidth: 320 }}
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
          >
            {availableLists.map((l) => (
              <option key={l.ListId} value={l.ListId}>
                {l.Name || l.ListId}
              </option>
            ))}
          </select>

          <select aria-label="Visning" style={{ maxWidth: 180 }} value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
            <option value="list">Liste</option>
            <option value="gallery">Galleri</option>
          </select>
        </div>

        <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
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

        <div className="small" style={{ marginTop: 8 }}>
          Uge {selectedWeek} · Kun ikke sete
        </div>
        <div style={{ marginTop: 8 }}>
          <Link to={selectedListId ? `/lists/${selectedListId}` : '/'}>Tilbage til listen</Link>
        </div>
        {error ? <div className="small">{error}</div> : null}
      </div>

      <div className="card">
        {loading ? (
          <div className="small">Indlæser…</div>
        ) : items.length === 0 ? (
          <div className="small">Ingen sandsynlige ikke-sete arter i uge {selectedWeek}.</div>
        ) : viewMode === 'gallery' ? (
          <div className="galleryGrid" aria-label="Galleri">
            {items.map((x) => (
              <div key={x.entryId} className="galleryCell">
                <div className="galleryTile">
                  <div className="galleryTile__name">{x.danishName || x.speciesId}</div>
                  <button
                    type="button"
                    className="seenToggleButton seenToggleButton--unseen galleryTile__seenButton"
                    onClick={() => markSeen(x.entryId)}
                    aria-label="Marker som set"
                  >
                    Set
                  </button>
                  <SpeciesThumbnail
                    speciesId={x.speciesId}
                    speciesClass={x.speciesClass}
                    alt={x.danishName || ''}
                    className="galleryThumb"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="list entryList">
            {items.map((x) => {
              const link = getSpeciesExternalLink({ speciesClass: x.speciesClass, speciesId: x.speciesId })
              const url = getDofKnownLocationsUrl({ speciesId: x.speciesId, weekNumber: selectedWeek, year: currentYear })
              return (
                <li key={x.entryId}>
                  <div className="entryItem">
                    <div className="entryNameLine">
                      <SpeciesName
                        danishName={x.danishName}
                        speciesId={x.speciesId}
                        speciesStatus={x.speciesStatus}
                        speciesClass={x.speciesClass}
                      />
                      <div className="small">{x.latinName || ''}</div>
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
                          type="button"
                          className="seenToggleButton seenToggleButton--unseen"
                          onClick={() => markSeen(x.entryId)}
                          aria-label="Marker som set"
                        >
                          Set
                        </button>
                        <SpeciesThumbnail
                          speciesId={x.speciesId}
                          speciesClass={x.speciesClass}
                          alt={x.danishName || ''}
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
