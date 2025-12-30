import React, { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

const INSTALL_LANDING_DISMISSED_KEY = 'installLandingDismissed'

function isIOSDevice() {
  try {
    const ua = String(navigator?.userAgent || '')
    const iOS = /iPad|iPhone|iPod/i.test(ua)

    // iPadOS 13+ may identify as Mac; detect touch-capable Macs.
    const iPadOS =
      !iOS &&
      /Macintosh/i.test(ua) &&
      typeof navigator?.maxTouchPoints === 'number' &&
      navigator.maxTouchPoints > 1

    return iOS || iPadOS
  } catch {
    return false
  }
}

function isStandaloneDisplayMode() {
  try {
    // iOS Safari exposes navigator.standalone, other browsers use display-mode media query.
    // eslint-disable-next-line no-undef
    if (typeof navigator !== 'undefined' && navigator.standalone === true) return true
    // eslint-disable-next-line no-undef
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return Boolean(window.matchMedia('(display-mode: standalone)')?.matches)
    }
    return false
  } catch {
    return false
  }
}

function isAndroidDevice() {
  try {
    const ua = String(navigator?.userAgent || '')
    return /Android/i.test(ua)
  } catch {
    return false
  }
}

function getInstallLandingDismissed() {
  try {
    return localStorage.getItem(INSTALL_LANDING_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function setInstallLandingDismissed() {
  try {
    localStorage.setItem(INSTALL_LANDING_DISMISSED_KEY, '1')
  } catch {
    // Ignore
  }
}

export default function LandingPage() {
  const navigate = useNavigate()

  const ios = useMemo(() => isIOSDevice(), [])
  const android = useMemo(() => isAndroidDevice(), [])
  const standalone = useMemo(() => isStandaloneDisplayMode(), [])
  const dismissed = useMemo(() => getInstallLandingDismissed(), [])

  useEffect(() => {
    if (!dismissed && !standalone) return
    navigate('/lists', { replace: true })
  }, [dismissed, standalone, navigate])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 6 }}>BigYearPWA</div>
        <div className="small">
          For bedste oplevelse (offline og hurtig opstart), tilføj appen til hjemmeskærmen.
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Føj til hjemmeskærm</div>

        {standalone ? (
          <div className="small">Appen kører allerede fra hjemmeskærmen.</div>
        ) : ios ? (
          <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>Åbn siden i Safari.</li>
            <li>Tryk på Del-knappen (□↑).</li>
            <li>Vælg “Føj til hjemmeskærm”.</li>
            <li>Tryk “Tilføj”.</li>
          </ol>
        ) : android ? (
          <ol className="small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
            <li>Åbn siden i Chrome.</li>
            <li>Tryk på menuen (⋮).</li>
            <li>Vælg “Installér app” eller “Føj til startskærm”.</li>
            <li>Tryk “Installér” / “Tilføj”.</li>
          </ol>
        ) : (
          <div className="small">
            Åbn siden i din mobilbrowser og brug browserens menu til at “Installere app” / “Føj til
            hjemmeskærm”.
          </div>
        )}

        <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setInstallLandingDismissed()
              navigate('/lists', { replace: true })
            }}
            aria-label="Fortsæt til lister"
          >
            Fortsæt
          </button>
        </div>
      </div>

      <div className="card">
        <div className="small">
          Tip: Hvis du åbner linket i en anden browser end Safari på iPhone, kan du ofte vælge “Åbn i
          Safari” først.
        </div>
      </div>
    </div>
  )
}
