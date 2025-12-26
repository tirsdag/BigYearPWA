import React, { useEffect, useMemo, useState } from 'react'

function toClassKey(speciesClass) {
  return String(speciesClass || '').trim().toLowerCase()
}

function getCategoryFallbackSrc(speciesClass) {
  const key = toClassKey(speciesClass)
  if (!key) return './images/default.jpeg'
  return `./images/${key}/default.jpeg`
}

let sharedViewer = null

function ensureSharedViewer() {
  if (sharedViewer) return sharedViewer
  if (typeof document === 'undefined') return null

  const overlay = document.createElement('div')
  overlay.className = 'speciesImageOverlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-hidden', 'true')

  const img = document.createElement('img')
  img.className = 'speciesImageOverlay__img'
  img.alt = ''
  overlay.appendChild(img)

  function close() {
    overlay.style.display = 'none'
    overlay.setAttribute('aria-hidden', 'true')
    // Release memory on iOS by clearing src.
    img.removeAttribute('src')
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })

  document.body.appendChild(overlay)

  sharedViewer = { overlay, img, close }
  return sharedViewer
}

export default function SpeciesThumbnail({ speciesId, speciesClass, alt = '', size = 352, className = '' }) {
  const id = String(speciesId || '').trim()
  const classKey = useMemo(() => toClassKey(speciesClass), [speciesClass])
  const fallbackSrc = useMemo(() => getCategoryFallbackSrc(speciesClass), [speciesClass])

  const candidates = useMemo(() => {
    const items = []

    if (id) {
      items.push(
        classKey ? `./images/${classKey}/${id}.png` : null,
        classKey ? `./images/${classKey}/${id}.jpg` : null,
        classKey ? `./images/${classKey}/${id}.jpeg` : null
      )
    }

    items.push(fallbackSrc)
    items.push('./images/default.jpeg')

    // De-dupe while preserving order.
    return items.filter(Boolean).filter((x, idx, arr) => arr.indexOf(x) === idx)
  }, [id, classKey, fallbackSrc])

  const [candidateIndex, setCandidateIndex] = useState(0)
  const src = candidates[candidateIndex] || './images/default.jpeg'

  // If props change (different list row), keep src in sync.
  useEffect(() => {
    setCandidateIndex(0)
  }, [candidates])

  function onError() {
    setCandidateIndex((i) => (i < candidates.length - 1 ? i + 1 : i))
  }

  function openPreview() {
    const viewer = ensureSharedViewer()
    if (!viewer) {
      window.open(src, '_blank', 'noopener,noreferrer')
      return
    }

    const { overlay, img } = viewer

    img.src = src
    img.alt = alt || ''
    overlay.style.display = 'flex'
    overlay.setAttribute('aria-hidden', 'false')
  }

  return (
    <button
      type="button"
      className="speciesThumbButton"
      onClick={openPreview}
      aria-label="Vis billede større"
    >
      <img
        className={['speciesThumb', className].filter(Boolean).join(' ')}
        src={src}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={onError}
      />
    </button>
  )
}
