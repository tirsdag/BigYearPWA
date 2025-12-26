import React, { useEffect, useMemo, useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import ListsPage from './ui/ListsPage.jsx'
import ListDetailPage from './ui/ListDetailPage.jsx'
import AllSpeciesPage from './ui/AllSpeciesPage.jsx'
import ProbableSpeciesPage from './ui/ProbableSpeciesPage.jsx'
import { bootstrapReferenceData } from './services/bootstrapService.js'
import { AppStateContext } from './ui/appState.js'
import { createList, listLists, SPECIES_CLASSES } from './services/listService.js'
import { listDimensions } from './services/dimensionService.js'

export default function App() {
  const navigate = useNavigate()

  const [isBootstrapped, setIsBootstrapped] = useState(false)
  const [bootstrapError, setBootstrapError] = useState(null)
  const [activeListId, setActiveListId] = useState(localStorage.getItem('activeListId') || '')

  useEffect(() => {
    localStorage.setItem('activeListId', activeListId || '')
  }, [activeListId])

  useEffect(() => {
    bootstrapReferenceData()
      .then(() => setIsBootstrapped(true))
      .catch((err) => {
        setBootstrapError(err)
        setIsBootstrapped(true)
      })
  }, [])

  useEffect(() => {
    if (!isBootstrapped) return
    if (bootstrapError) return

    try {
      if (sessionStorage.getItem('startupDone') === '1') return
      sessionStorage.setItem('startupDone', '1')
    } catch {
      // If sessionStorage is unavailable, just skip auto-redirect.
      return
    }

    ;(async () => {
      const lists = await listLists()

      if (lists.length === 0) {
        const dims = await listDimensions()
        const dk = dims.find((d) => String(d?.DimensionId || '').toLowerCase() === 'dk')
        const dimensionId = (dk?.DimensionId || dims?.[0]?.DimensionId || '').toString()
        if (!dimensionId) return

        const avesClass = 'Aves'
        const otherClasses = SPECIES_CLASSES.filter((c) => c !== avesClass)

        const nameByClass = {
          Amphibia: 'Mine padder',
          Aves: 'Mine fugle',
          Insecta: 'Mine insekter',
          Mammalia: 'Mine pattedyr',
          Reptilia: 'Mine krybdyr',
        }

        // Prioritize creating the bird list first so we can land the user on it quickly.
        const avesList = await createList({
          name: nameByClass[avesClass] || avesClass,
          dimensionId,
          speciesClasses: [avesClass],
        })

        setActiveListId(avesList.ListId)
        navigate(`/lists/${avesList.ListId}`, { replace: true })

        // Create the remaining lists in the background.
        Promise.resolve()
          .then(async () => {
            for (const cls of otherClasses) {
              await createList({
                name: nameByClass[cls] || cls,
                dimensionId,
                speciesClasses: [cls],
              })
            }
          })
          .catch(() => {})

        return
      }

      const desired = activeListId && lists.some((l) => l.ListId === activeListId) ? activeListId : ''

      const avesFallback =
        lists.find((l) => Array.isArray(l?.SpeciesClasses) && l.SpeciesClasses.includes('Aves'))?.ListId ||
        lists.find((l) => String(l?.Name || '').trim() === 'Mine fugle')?.ListId ||
        ''

      const fallback = avesFallback || lists[0].ListId
      const target = desired || fallback

      if (!desired && target) setActiveListId(target)
      if (target) navigate(`/lists/${target}`, { replace: true })
    })().catch(() => {})
  }, [isBootstrapped, bootstrapError, activeListId, navigate])

  const ctx = useMemo(
    () => ({
      activeListId,
      setActiveListId,
    }),
    [activeListId],
  )

  if (!isBootstrapped) {
    return (
      <AppStateContext.Provider value={ctx}>
        <div className="app">
          <main className="main">
            <div className="card">Indlæser…</div>
          </main>
        </div>
      </AppStateContext.Provider>
    )
  }

  return (
    <AppStateContext.Provider value={ctx}>
      <div className="app">
        <main className="main">
          {bootstrapError ? (
            <div className="card">
              <div>Indlæsning af referencedata mislykkedes.</div>
              <div className="small">{String(bootstrapError?.message || bootstrapError)}</div>
            </div>
          ) : null}

          <Routes>
            <Route path="/" element={<ListsPage />} />
            <Route path="/lists/:listId" element={<ListDetailPage />} />
            <Route path="/species" element={<AllSpeciesPage />} />
            <Route path="/probable" element={<ProbableSpeciesPage />} />
          </Routes>
        </main>
      </div>
    </AppStateContext.Provider>
  )
}
