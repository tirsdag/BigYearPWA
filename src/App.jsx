import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import ListsPage from './ui/ListsPage.jsx'
import ListDetailPage from './ui/ListDetailPage.jsx'
import AllSpeciesPage from './ui/AllSpeciesPage.jsx'
import ProbableSpeciesPage from './ui/ProbableSpeciesPage.jsx'
import { bootstrapReferenceData } from './services/bootstrapService.js'
import { AppStateContext } from './ui/appState.js'

export default function App() {
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

        <nav className="nav">
          <NavLink to="/" end>
            Lister
          </NavLink>
          <NavLink to="/species">Alle arter</NavLink>
          <NavLink to="/probable">Sandsynlige</NavLink>
        </nav>
      </div>
    </AppStateContext.Provider>
  )
}
