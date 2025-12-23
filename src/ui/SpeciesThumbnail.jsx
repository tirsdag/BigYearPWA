import React, { useEffect, useMemo, useState } from 'react'

function toClassKey(speciesClass) {
  return String(speciesClass || '').trim().toLowerCase()
}

function getCategoryFallbackSrc(speciesClass) {
  const key = toClassKey(speciesClass)
  if (!key) return './images/species/default.jpeg'
  return `./images/species/${key}.jpeg`
}

let sharedViewer = null

function ensureSharedViewer() {
  if (sharedViewer) return sharedViewer
  if (typeof document === 'undefined') return null

  const dialog = document.createElement('dialog')
  dialog.className = 'speciesImageDialog'
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close()
  })

  const img = document.createElement('img')
  img.className = 'speciesImageDialog__img'
  img.alt = ''
  dialog.appendChild(img)

  document.body.appendChild(dialog)

  sharedViewer = { dialog, img }
  return sharedViewer
}

export default function SpeciesThumbnail({ speciesId, speciesClass, alt = '', size = 44, className = '' }) {
  const id = String(speciesId || '').trim()
  const fallbackSrc = useMemo(() => getCategoryFallbackSrc(speciesClass), [speciesClass])

  const candidates = useMemo(() => {
    const items = []

    if (id) {
      items.push(
        `./images/species/${id}.png`,
        `./images/species/${id}.jpg`,
        `./images/species/${id}.jpeg`
      )
    }

    items.push(fallbackSrc)
    items.push('./images/species/default.jpeg')

    // De-dupe while preserving order.
    return items.filter(Boolean).filter((x, idx, arr) => arr.indexOf(x) === idx)
  }, [id, fallbackSrc])

  const [candidateIndex, setCandidateIndex] = useState(0)
  const src = candidates[candidateIndex] || './images/species/default.jpeg'

  // If props change (different list row), keep src in sync.
  useEffect(() => {
    setCandidateIndex(0)
  }, [candidates])

  function onError() {
    setCandidateIndex((i) => (i < candidates.length - 1 ? i + 1 : i))
  }

  function openPreview() {
    const viewer = ensureSharedViewer()
    if (!viewer) return

    const { dialog, img } = viewer
    img.src = src
    img.alt = alt || ''

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal()
      return
    }

    // Fallback for older browsers without <dialog>.
    window.open(src, '_blank', 'noopener,noreferrer')
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
