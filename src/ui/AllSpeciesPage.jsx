import React, { useEffect, useState } from 'react'
import { listSpecies } from '../services/speciesService.js'
import { SPECIES_CLASSES } from '../services/listService.js'
import SpeciesName from './SpeciesName.jsx'

export default function AllSpeciesPage() {
  const [speciesClass, setSpeciesClass] = useState('')
  const [species, setSpecies] = useState([])

  useEffect(() => {
    listSpecies({ speciesClass }).then(setSpecies).catch(() => setSpecies([]))
  }, [speciesClass])

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
          <div className="small">{species.length} arter</div>
        </div>
      </div>

      <div className="card">
        {species.length === 0 ? (
          <div className="small">Ingen arter.</div>
        ) : (
          <ul className="list">
            {species.map((s) => (
              <li key={s.speciesId} style={{ marginBottom: 12 }}>
                <div>
                  <SpeciesName
                    danishName={s.danishName}
                    speciesId={s.speciesId}
                    speciesStatus={s.speciesStatus}
                  />
                </div>
                <div className="small">{s.latinName}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
