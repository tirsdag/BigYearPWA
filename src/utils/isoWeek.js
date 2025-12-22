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

export function getISOWeekStartDate(isoYear, isoWeek) {
  const year = Number(isoYear)
  const week = Number(isoWeek)

  // Use local dates for display purposes.
  // ISO week 1 is the week with Jan 4th, and weeks start on Monday.
  const jan4 = new Date(year, 0, 4)
  jan4.setHours(12, 0, 0, 0)

  const dayNum = jan4.getDay() || 7 // 1..7 (Mon..Sun)
  const mondayWeek1 = new Date(jan4)
  mondayWeek1.setDate(jan4.getDate() - (dayNum - 1))

  const start = new Date(mondayWeek1)
  start.setDate(mondayWeek1.getDate() + (week - 1) * 7)
  start.setHours(12, 0, 0, 0)
  return start
}
