async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Kunne ikke hente ${url}: ${res.status} ${res.statusText}`)
  }

  // Some bundled assets (notably WeekStat files) are UTF-16LE encoded.
  // `response.json()` assumes UTF-8 and will throw.
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const text = sanitizeJsonText(decodeTextWithBom(bytes))
  if (!text) {
    throw new Error(`Tom JSON fra ${url}`)
  }

  try {
    return JSON.parse(text)
  } catch (err) {
    const preview = text.slice(0, 50)
    throw new Error(`Ugyldig JSON fra ${url}: ${preview}`)
  }
}

function sanitizeJsonText(text) {
  // Remove BOM char and any embedded NULs that can appear when decoding UTF-16 content.
  return String(text).replace(/^\uFEFF/, '').replace(/\u0000/g, '').trim()
}

function decodeTextWithBom(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    // UTF-16 LE BOM
    return new TextDecoder('utf-16le').decode(bytes)
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    // UTF-16 BE BOM
    return new TextDecoder('utf-16be').decode(bytes)
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    // UTF-8 BOM
    return new TextDecoder('utf-8').decode(bytes)
  }

  return new TextDecoder('utf-8').decode(bytes)
}

export function fetchSpeciesFile(speciesClass) {
  return fetchJson(`Data/Species/SPECIES-${speciesClass}.json`).then((data) => {
    // Legacy files were arrays; corrected files are shaped as { species: [...] }
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.species)) return data.species
    throw new Error(`Uventet artsdata-format for ${speciesClass}`)
  })
}

export function fetchDimensionsPreset() {
  return fetchJson('Data/dimensions.json')
}

export async function fetchWeekStat(speciesClass, weekNumber) {
  const url = `Data/WeekStat/${speciesClass}-${weekNumber}.json`
  try {
    return await fetchJson(url)
  } catch (err) {
    // Some WeekStat files may be intentionally empty for certain classes/weeks.
    if (String(err?.message || '').startsWith('Tom JSON fra')) {
      return { species: [] }
    }
    throw err
  }
}

export function fetchSpeciesWeeklyTrend() {
  return fetchJson('Data/WeekStat/species_weekly_trend.json').then((data) => {
    if (!Array.isArray(data)) {
      throw new Error('Uventet weekly trend-format (forventer array)')
    }

    return data
      .map((row) => ({
        speciesId: String(row?.speciesId || ''),
        weeklyTrend: String(row?.weeklyTrend || ''),
      }))
      .filter((x) => x.speciesId)
  })
}
