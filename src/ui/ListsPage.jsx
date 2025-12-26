import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAppState } from './appState.js'
import { createList, getListEntries, listLists, removeList, SPECIES_CLASSES } from '../services/listService.js'
import { listDimensions } from '../services/dimensionService.js'
import { getSpeciesByClass, getSpeciesById } from '../repositories/speciesRepository.js'
import SpeciesThumbnail from './SpeciesThumbnail.jsx'

const SPECIES_CLASS_LABELS = {
  Amphibia: 'Padder',
  Aves: 'Fugle',
  Insecta: 'Insekter',
  Mammalia: 'Pattedyr',
  Reptilia: 'Krybdyr',
}

export default function ListsPage() {
  const navigate = useNavigate()
  const { activeListId, setActiveListId } = useAppState()

  const [lists, setLists] = useState([])
  const [dimensions, setDimensions] = useState([])

  const [name, setName] = useState('')
  const [dimensionId, setDimensionId] = useState('')
  const [selectedClasses, setSelectedClasses] = useState(() => new Set(['Aves']))

  const [previewSpeciesIdByClass, setPreviewSpeciesIdByClass] = useState(() => new Map())
  const [classesByListId, setClassesByListId] = useState(() => new Map())

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

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const next = new Map()
      for (const cls of SPECIES_CLASSES) {
        try {
          const species = await getSpeciesByClass(cls)
          const pick = species && species.length ? species[Math.floor(Math.random() * species.length)] : null
          if (pick?.speciesId) next.set(cls, String(pick.speciesId))
        } catch {
          // Ignore; previews are non-critical.
        }
      }
      if (cancelled) return
      setPreviewSpeciesIdByClass(next)
    })().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const speciesClassCache = new Map()

    async function inferClassesForList(listId) {
      const entries = await getListEntries(listId)
      if (!entries || entries.length === 0) return []

      const sampleCount = Math.min(200, entries.length)
      const found = new Set()

      for (let i = 0; i < sampleCount; i++) {
        if (found.size >= SPECIES_CLASSES.length) break

        const idx = sampleCount <= 1 ? 0 : Math.floor((i * (entries.length - 1)) / (sampleCount - 1))
        const speciesId = String(entries[idx]?.SpeciesId || '')
        if (!speciesId) continue

        let cls = speciesClassCache.get(speciesId)
        if (!cls) {
          const ref = await getSpeciesById(speciesId)
          cls = String(ref?.speciesClass || '').trim()
          if (cls) speciesClassCache.set(speciesId, cls)
        }
        if (cls) found.add(cls)
      }

      return Array.from(found)
    }

    ;(async () => {
      for (const l of lists) {
        if (cancelled) return

        const listId = String(l?.ListId || '')
        if (!listId) continue

        setClassesByListId((prev) => {
          if (prev.has(listId)) return prev
          return new Map(prev)
        })

        if (Array.isArray(l?.SpeciesClasses) && l.SpeciesClasses.length > 0) {
          setClassesByListId((prev) => {
            const next = new Map(prev)
            next.set(listId, l.SpeciesClasses.map((x) => String(x)))
            return next
          })
          continue
        }

        const inferred = await inferClassesForList(listId)
        if (cancelled) return
        setClassesByListId((prev) => {
          const next = new Map(prev)
          next.set(listId, inferred)
          return next
        })
      }
    })().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [lists])

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
            Listetype{' '}
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
          <div className="speciesClassPickList">
            {SPECIES_CLASSES.map((cls) => (
              <label key={cls} className="speciesClassPick" style={{ userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={selectedClasses.has(cls)}
                  onChange={() => toggleClass(cls)}
                />
                {previewSpeciesIdByClass.get(cls) ? (
                  <SpeciesThumbnail
                    speciesId={previewSpeciesIdByClass.get(cls)}
                    speciesClass={cls}
                    alt={SPECIES_CLASS_LABELS[cls] || cls}
                    size={44}
                    className="classPreviewThumb"
                  />
                ) : null}
                <span>{SPECIES_CLASS_LABELS[cls] || cls}</span>
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
                <div className="listRow">
                  <div className="listRowMain">
                    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                        <Link to={`/lists/${l.ListId}`} onClick={() => setActiveListId(l.ListId)}>
                          {l.Name}
                        </Link>
                        {activeListId === l.ListId ? <span className="small">(aktiv)</span> : null}
                      </div>
                      {(() => {
                        const cls = classesByListId.get(String(l.ListId)) || []
                        if (!cls || cls.length === 0) return null
                        const label = cls
                          .map((x) => SPECIES_CLASS_LABELS[String(x)] || String(x))
                          .join(', ')
                        return <div className="small">{label}</div>
                      })()}
                    </div>
                  </div>
                  <div className="listRowActions">
                    <button type="button" onClick={() => setActiveListId(l.ListId)}>
                      Sæt aktiv
                    </button>
                    <button type="button" onClick={() => onDelete(l.ListId)}>
                      Slet
                    </button>
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
