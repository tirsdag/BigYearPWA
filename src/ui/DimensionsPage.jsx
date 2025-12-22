import React, { useEffect, useState } from 'react'
import { createDimensionSet, listDimensions, removeDimensionSet } from '../services/dimensionService.js'

export default function DimensionsPage() {
  const [dimensions, setDimensions] = useState([])
  const [form, setForm] = useState({
    Year: String(new Date().getFullYear()),
    Month: '',
    WeekNumber: '',
    LocationId: '',
    Municipality: '',
    Region: '',
  })

  async function refresh() {
    setDimensions(await listDimensions())
  }

  useEffect(() => {
    refresh().catch(() => {})
  }, [])

  async function onCreate() {
    await createDimensionSet(form)
    setForm((p) => ({ ...p, LocationId: '', Municipality: '', Region: '' }))
    await refresh()
  }

  async function onDelete(id) {
    if (!confirm('Slet dimensionssæt?')) return
    await removeDimensionSet(id)
    await refresh()
  }

  function setField(key, value) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Opret dimensionssæt</div>
        <div className="row" style={{ marginBottom: 8 }}>
          <label>
            År <input value={form.Year} onChange={(e) => setField('Year', e.target.value)} />
          </label>
          <label>
            Måned <input value={form.Month} onChange={(e) => setField('Month', e.target.value)} placeholder="tom" />
          </label>
          <label>
            Uge <input value={form.WeekNumber} onChange={(e) => setField('WeekNumber', e.target.value)} placeholder="tom" />
          </label>
        </div>
        <div className="row" style={{ marginBottom: 8 }}>
          <label>
            Lokations-id{' '}
            <input value={form.LocationId} onChange={(e) => setField('LocationId', e.target.value)} placeholder="tom" />
          </label>
          <label>
            Kommune{' '}
            <input value={form.Municipality} onChange={(e) => setField('Municipality', e.target.value)} placeholder="tom" />
          </label>
          <label>
            Region <input value={form.Region} onChange={(e) => setField('Region', e.target.value)} placeholder="tom" />
          </label>
        </div>
        <button onClick={onCreate}>Opret</button>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Dimensionssæt</div>
        {dimensions.length === 0 ? (
          <div className="small">Ingen dimensionssæt.</div>
        ) : (
          <ul className="list">
            {dimensions.map((d) => (
              <li key={d.DimensionId} style={{ marginBottom: 10 }}>
                <div className="row">
                  <div style={{ fontWeight: 600 }}>{d.DimensionId}</div>
                  <button onClick={() => onDelete(d.DimensionId)}>Slet</button>
                </div>
                <div className="small">
                  År={String(d.Year)} Måned={String(d.Month)} Uge={String(d.WeekNumber)} Lokations-id={String(d.LocationId)} Kommune={String(d.Municipality)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
