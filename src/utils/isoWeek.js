export function getISOWeek(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = utcDate.getUTCDay() || 7

  // Move to Thursday in current week to decide the year.
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum)

  const isoYear = utcDate.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7)

  return { year: isoYear, week }
}
