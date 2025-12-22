import { deleteDimension, getAllDimensions, putDimension } from '../repositories/dimensionRepository.js'
import { newId } from '../utils/id.js'

export async function listDimensions() {
  const dims = await getAllDimensions()
  return dims.slice().sort((a, b) => String(a.DimensionId).localeCompare(String(b.DimensionId)))
}

export async function createDimensionSet(partial) {
  const dimension = {
    DimensionId: newId(),
    Year: Number(partial.Year) || new Date().getFullYear(),
    Month: partial.Month === '' ? null : toNullableNumber(partial.Month),
    WeekNumber: partial.WeekNumber === '' ? null : toNullableNumber(partial.WeekNumber),
    LocationId: partial.LocationId || null,
    Municipality: partial.Municipality || null,
    Region: partial.Region || null,
  }

  await putDimension(dimension)
  return dimension
}

export async function removeDimensionSet(dimensionId) {
  await deleteDimension(dimensionId)
}

function toNullableNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
