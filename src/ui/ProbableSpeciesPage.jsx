import React, { useEffect, useState } from 'react'
import { SPECIES_CLASSES } from '../services/listService.js'
import { getProbableSpeciesThisWeekForClass } from '../services/probableSpeciesService.js'

export default function ProbableSpeciesPage() {
  const [speciesClass, setSpeciesClass] = useState('Aves')
  const [result, setResult] = useState({ week: null, items: [] })
  const [error, setError] = useState(null)

  useEffect(() => {
    getProbableSpeciesThisWeekForClass({ speciesClass })
      .then((r) => {
        setResult(r)
        setError(null)
      })
      .catch((e) => {
        setResult({ week: null, items: [] })
        setError(e)
      })
  }, [speciesClass])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
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
          <div className="small">Uge {result.week ?? '—'}</div>
        </div>
        {error ? <div className="small">{String(error?.message || error)}</div> : null}
      </div>

      <div className="card">
        {result.items.length === 0 ? (
          <div className="small">Ingen træffere.</div>
        ) : (
          <ul className="list">
            {result.items.map((x) => (
              <li key={x.speciesId} style={{ marginBottom: 10 }}>
                <div className="row">
                  <div style={{ minWidth: 80, fontWeight: 600 }}>Score: {x.rScore}</div>
                  <div style={{ minWidth: 90 }} className="small">
                    Observationer: {x.obsCount}
                  </div>
                  <div>
                    <div>{x.danishName || x.speciesId}</div>
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
