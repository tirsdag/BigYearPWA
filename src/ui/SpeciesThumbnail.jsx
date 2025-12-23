import React, { useEffect, useMemo, useState } from 'react'

function toClassKey(speciesClass) {
  return String(speciesClass || '').trim().toLowerCase()
}

function getCategoryFallbackSrc(speciesClass) {
  const key = toClassKey(speciesClass)
  if (!key) return './images/species/default.jpeg'
  return `./images/species/${key}.jpeg`
}

export default function SpeciesThumbnail({ speciesId, speciesClass, alt = '', size = 44, className = '' }) {
  const id = String(speciesId || '').trim()
  const primarySrc = useMemo(() => (id ? `./images/species/${id}.jpg` : ''), [id])
  const fallbackSrc = useMemo(() => getCategoryFallbackSrc(speciesClass), [speciesClass])

  const [src, setSrc] = useState(primarySrc || fallbackSrc)

  // If props change (different list row), keep src in sync.
  useEffect(() => {
    setSrc(primarySrc || fallbackSrc)
  }, [primarySrc, fallbackSrc])

  function onError() {
    if (src === fallbackSrc) {
      if (fallbackSrc !== './images/species/default.jpeg') {
        setSrc('./images/species/default.jpeg')
      }
      return
    }

    setSrc(fallbackSrc)
  }

  return (
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
  )
}
