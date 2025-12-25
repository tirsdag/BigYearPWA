export function getDofKnownLocationsUrl({ speciesId = '', weekNumber, year } = {}) {
  const id = String(speciesId || '').trim()
  if (!id) return ''

  const week = Number(weekNumber)
  if (!Number.isFinite(week) || week < 1 || week > 53) return ''

  const currentYear = Number(year) || new Date().getFullYear()

  const params = new URLSearchParams({
    design: 'table',
    soeg: 'soeg',
    periode: 'maanedaar',
    uge: String(Math.trunc(week)),
    aar_first: String(currentYear - 1),
    aar_second: String(currentYear),
    artdata: 'art',
    hiddenart: id,
    obstype: 'observationer',
    summering: 'yes',
    sortering: 'dato',
  })

  return `https://dofbasen.dk/search/result.php?${params.toString()}`
}
