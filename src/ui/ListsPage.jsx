import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppState } from './appState.js'
import { createList, listLists, removeList, SPECIES_CLASSES } from '../services/listService.js'
import { listDimensions } from '../services/dimensionService.js'

export default function ListsPage() {
  const navigate = useNavigate()
  const { activeListId, setActiveListId } = useAppState()

  const [lists, setLists] = useState([])
  const [dimensions, setDimensions] = useState([])

  const [name, setName] = useState('')
  const [dimensionId, setDimensionId] = useState('')
  const [selectedClasses, setSelectedClasses] = useState(() => new Set(['Aves']))

  const classArray = useMemo(() => Array.from(selectedClasses), [selectedClasses])

  async function refresh() {
    const [l, d] = await Promise.all([listLists(), listDimensions()])
    setLists(l)
    setDimensions(d)
    if (!dimensionId && d.length > 0) setDimensionId(d[0].DimensionId)
  }

  useEffect(() => {
    refresh().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onCreate() {
    const list = await createList({ name, dimensionId, speciesClasses: classArray })
    setName('')
    await refresh()
    setActiveListId(list.ListId)
    navigate(`/lists/${list.ListId}`)
  }

  async function onDelete(listId) {
    if (!confirm('Slet liste?')) return
    await removeList(listId)
    if (activeListId === listId) setActiveListId('')
    await refresh()
  }

  function toggleClass(cls) {
    setSelectedClasses((prev) => {
      const next = new Set(prev)
      if (next.has(cls)) next.delete(cls)
      else next.add(cls)
      return next
    })
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Opret liste</div>
        <div className="row" style={{ marginBottom: 8 }}>
          <label>
            Navn{' '}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Listenavn" />
          </label>

          <label>
            Dimension{' '}
            <select value={dimensionId} onChange={(e) => setDimensionId(e.target.value)}>
              <option value="">Vælg…</option>
              {dimensions.map((d) => (
                <option key={d.DimensionId} value={d.DimensionId}>
                  {d.DimensionId}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div className="small" style={{ marginBottom: 6 }}>
            Artsklasser (vælg 1+)
          </div>
          <div className="row">
            {SPECIES_CLASSES.map((cls) => (
              <label key={cls} style={{ userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={selectedClasses.has(cls)}
                  onChange={() => toggleClass(cls)}
                />{' '}
                {cls}
              </label>
            ))}
          </div>
        </div>

        <button onClick={onCreate} disabled={!dimensionId || classArray.length === 0}>
          Opret
        </button>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Lister</div>
        {lists.length === 0 ? (
          <div className="small">Ingen lister endnu.</div>
        ) : (
          <ul className="list">
            {lists.map((l) => (
              <li key={l.ListId} style={{ marginBottom: 8 }}>
                <div className="row">
                  <Link to={`/lists/${l.ListId}`} onClick={() => setActiveListId(l.ListId)}>
                    {l.Name}
                  </Link>
                  {activeListId === l.ListId ? <span className="small">(aktiv)</span> : null}
                  <button onClick={() => setActiveListId(l.ListId)}>Sæt aktiv</button>
                  <button onClick={() => onDelete(l.ListId)}>Slet</button>
                </div>
                <div className="small">{l.ListId}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
