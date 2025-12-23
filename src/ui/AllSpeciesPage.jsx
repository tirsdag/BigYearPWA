import React, { useEffect, useState } from 'react'
import { listSpecies } from '../services/speciesService.js'
import { SPECIES_CLASSES } from '../services/listService.js'
import SpeciesName from './SpeciesName.jsx'
import SpeciesThumbnail from './SpeciesThumbnail.jsx'

export default function AllSpeciesPage() {
  const [speciesClass, setSpeciesClass] = useState('')
  const [query, setQuery] = useState('')
  const [species, setSpecies] = useState([])

  useEffect(() => {
    listSpecies({ speciesClass }).then(setSpecies).catch(() => setSpecies([]))
  }, [speciesClass])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? species.filter((s) => String(s?.danishName || '').toLowerCase().includes(q))
    : species

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="card">
        <div className="row">
          <label>
            Klasse{' '}
            <select value={speciesClass} onChange={(e) => setSpeciesClass(e.target.value)}>
              <option value="">Alle</option>
              {SPECIES_CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Søg{' '}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Dansk navn…"
              inputMode="search"
            />
          </label>
          <div className="small">{filtered.length} arter</div>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="small">Ingen arter.</div>
        ) : (
          <ul className="list">
            {filtered.map((s) => (
              <li key={s.speciesId} style={{ marginBottom: 12 }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <SpeciesThumbnail
                    speciesId={s.speciesId}
                    speciesClass={s.speciesClass}
                    alt={s.danishName || ''}
                  />
                  <div>
                    <SpeciesName
                      danishName={s.danishName}
                      speciesId={s.speciesId}
                      speciesStatus={s.speciesStatus}
                      speciesClass={s.speciesClass}
                    />
                    <div className="small">{s.latinName}</div>
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
