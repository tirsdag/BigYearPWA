import React from 'react'

const RED_BOLD = new Set(['AU', 'HU', 'BU', 'CU', 'U'])
const BROWN_BRACKETS = new Set(['EU', 'DU', 'E', 'D'])
const PURPLE_BRACKETS = new Set(['H', 'HS'])
const GREEN_BOLD = new Set(['AS'])
const DEFAULT = new Set(['A', 'X', 'C'])

const EXTERNAL_LINKS_BY_CLASS = {
  Aves: {
    label: 'DOF',
    urlForSpeciesId: (speciesId) => `https://dofbasen.dk/danmarksfugle/art/${speciesId}`,
  },
}

export function getSpeciesExternalLink({ speciesClass = '', speciesId = '' } = {}) {
  const cls = String(speciesClass || '').trim()
  const linkConfig = EXTERNAL_LINKS_BY_CLASS[cls]
  const id = String(speciesId || '').trim()
  const url = linkConfig?.urlForSpeciesId ? linkConfig.urlForSpeciesId(id) : ''
  if (!url) return null
  return { label: linkConfig?.label || 'Link', url }
}

function getStyleConfig(status) {
  const s = String(status || '').trim().toUpperCase()

  if (RED_BOLD.has(s)) return { variant: 'red', brackets: false, bold: true }
  if (GREEN_BOLD.has(s)) return { variant: 'green', brackets: false, bold: true }
  if (BROWN_BRACKETS.has(s)) return { variant: 'brown', brackets: true, bold: false }
  if (PURPLE_BRACKETS.has(s)) return { variant: 'purple', brackets: true, bold: false }
  if (DEFAULT.has(s)) return { variant: '', brackets: false, bold: false }

  return { variant: '', brackets: false, bold: false }
}

export default function SpeciesName({ danishName, speciesId, speciesStatus, speciesClass = '', className = '' }) {
  const name = String(danishName || speciesId || '').trim()
  const { variant, brackets, bold } = getStyleConfig(speciesStatus)

  const classes = ['speciesName']
  if (variant) classes.push(`speciesName--${variant}`)
  if (bold) classes.push('speciesName--bold')
  if (className) classes.push(className)

  const text = brackets ? `[${name}]` : name

  return (
    <span className={classes.join(' ')}>
      <span className="speciesNameText" title={text}>
        {text}
      </span>
    </span>
  )
}
