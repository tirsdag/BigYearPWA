import React, { useEffect, useState } from 'react'
import { SPECIES_CLASSES } from '../services/listService.js'
import { getProbableSpeciesThisWeekForClass } from '../services/probableSpeciesService.js'
import { getISOWeek, getISOWeekStartDate } from '../utils/isoWeek.js'
import SpeciesName from './SpeciesName.jsx'

const MAX_WEEK = 52

function formatWeekStartDateDa(date) {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC']
  const d = String(date.getDate()).padStart(2, '0')
  const m = months[date.getMonth()] || ''
  return `${d}-${m}`
}

export default function ProbableSpeciesPage() {
  const [speciesClass, setSpeciesClass] = useState('Aves')
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const w = getISOWeek(new Date()).week
    return Math.min(Math.max(1, w), MAX_WEEK)
  })
  const [result, setResult] = useState({ week: null, items: [] })
  const [error, setError] = useState(null)

  const isoYear = getISOWeek(new Date()).year

  function clampWeek(w) {
    const n = Number(w)
    if (!Number.isFinite(n)) return 1
    return Math.min(MAX_WEEK, Math.max(1, Math.trunc(n)))
  }

  function prevWeek() {
    setSelectedWeek((w) => (w <= 1 ? MAX_WEEK : w - 1))
  }

  function nextWeek() {
    setSelectedWeek((w) => (w >= MAX_WEEK ? 1 : w + 1))
  }

  useEffect(() => {
    getProbableSpeciesThisWeekForClass({ speciesClass, weekNumber: selectedWeek })
      .then((r) => {
        setResult(r)
        setError(null)
      })
      .catch((e) => {
        setResult({ week: null, items: [] })
        setError(e)
      })
  }, [speciesClass, selectedWeek])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <div className="row">
          <label>
            Klasse{' '}
            <select value={speciesClass} onChange={(e) => setSpeciesClass(e.target.value)}>
              {SPECIES_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Uge{' '}
            <select value={selectedWeek} onChange={(e) => setSelectedWeek(clampWeek(e.target.value))}>
              {Array.from({ length: MAX_WEEK }, (_, i) => i + 1).map((w) => {
                const start = getISOWeekStartDate(isoYear, w)
                return (
                  <option key={w} value={w}>
                    {w} ({formatWeekStartDateDa(start)})
                  </option>
                )
              })}
            </select>
          </label>
          <button type="button" onClick={prevWeek} aria-label="Forrige uge">
            Forrige
          </button>
          <button type="button" onClick={nextWeek} aria-label="Næste uge">
            Næste
          </button>
        </div>
        {error ? <div className="small">{String(error?.message || error)}</div> : null}
      </div>

      <div className="card">
        {result.items.length === 0 ? (
          <div className="small">Ingen træffere.</div>
        ) : (
          <ul className="list">
            {result.items.map((x) => (
              <li key={x.speciesId} style={{ marginBottom: 14 }}>
                <div className="row">
                  <div style={{ minWidth: 80, fontWeight: 600 }}>Score: {x.rScore}</div>
                  <div style={{ minWidth: 90 }} className="small">
                    Observationer: {x.obsCount}
                  </div>
                  <div>
                    <div>
                      <SpeciesName
                        danishName={x.danishName}
                        speciesId={x.speciesId}
                        speciesStatus={x.speciesStatus}
                        speciesClass={x.speciesClass || speciesClass}
                      />
                    </div>
                    <div className="small">{x.latinName}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
