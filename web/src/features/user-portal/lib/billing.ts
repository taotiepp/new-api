/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import dayjs from '@/lib/dayjs'
import {
  formatChartTime,
  getEndOfDay,
  getStartOfDay,
  type TimeGranularity,
} from '@/lib/time'

export const PORTAL_BILLING_MAX_RANGE_SECONDS = 2_592_000
export const PORTAL_BILLING_ALL_MODELS = 'all'
const HOURLY_BUCKET = /^(\d{2}-\d{2}) (\d{2}:00)$/
export const PORTAL_BILLING_CHART_COLORS = [
  '#2563eb',
  '#f97316',
  '#16a34a',
  '#db2777',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
  '#4f46e5',
  '#0d9488',
  '#ea580c',
  '#64748b',
]

export type PortalBillingRow = {
  created_at: number
  model_name?: string
  token_used?: number
  count?: number
  quota?: number
}

export type PortalBillingStats = {
  quota: number
  count: number
  tokens: number
}

export type PortalBillingBarPoint = {
  bucket: string
  series: string
  quota: number
}

export function sumPortalBillingStats(
  rows: Array<{ quota?: number; count?: number; token_used?: number }>,
): PortalBillingStats {
  return rows.reduce<PortalBillingStats>(
    (acc, row) => ({
      quota: acc.quota + (Number(row.quota) || 0),
      count: acc.count + (Number(row.count) || 0),
      tokens: acc.tokens + (Number(row.token_used) || 0),
    }),
    { quota: 0, count: 0, tokens: 0 },
  )
}

export function granularityForBillingRange(
  start: Date,
  end: Date,
): TimeGranularity {
  const hours = (end.getTime() - start.getTime()) / 3_600_000
  if (hours <= 48) return 'hour'
  if (hours <= 24 * 14) return 'day'
  return 'week'
}

export function isPortalBillingRangeTooLong(start: Date, end: Date): boolean {
  return (end.getTime() - start.getTime()) / 1000 > PORTAL_BILLING_MAX_RANGE_SECONDS
}

export function createDefaultPortalBillingRange(now = new Date()): {
  start: Date
  end: Date
} {
  return { start: getStartOfDay(now), end: getEndOfDay(now) }
}

export function isDefaultPortalBillingRange(
  start: Date,
  end: Date,
  modelName = PORTAL_BILLING_ALL_MODELS,
  now = new Date(),
): boolean {
  const defaults = createDefaultPortalBillingRange(now)
  return (
    modelName === PORTAL_BILLING_ALL_MODELS &&
    dayjs(start).isSame(defaults.start, 'day') &&
    dayjs(end).isSame(defaults.end, 'day')
  )
}

export function formatPortalBillingRangeLabel(start: Date, end: Date): string {
  const sameDay = dayjs(start).isSame(end, 'day')
  if (sameDay) {
    const day = dayjs(start).format('MM/DD')
    return `${day} - ${day}`
  }
  return `${dayjs(start).format('MM/DD')} - ${dayjs(end).format('MM/DD')}`
}

export function modelNameForBillingRow(
  row: { model_name?: string },
  unknownLabel: string,
): string {
  return row.model_name?.trim() || unknownLabel
}

export function listPortalBillingModels(
  rows: Array<{ model_name?: string }>,
  unknownLabel: string,
): string[] {
  const names = new Set<string>()
  for (const row of rows) {
    names.add(modelNameForBillingRow(row, unknownLabel))
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

export function filterRowsByModelName<T extends { model_name?: string }>(
  rows: T[],
  modelName: string | null,
  unknownLabel: string,
): T[] {
  if (modelName == null) return rows
  return rows.filter(
    (row) => modelNameForBillingRow(row, unknownLabel) === modelName,
  )
}

export function compactPortalBillingAxisLabel(
  bucket: string,
  buckets: string[],
): string {
  const dates = new Set<string>()
  for (const item of buckets) {
    const match = HOURLY_BUCKET.exec(item)
    if (!match) return bucket
    dates.add(match[1])
  }
  if (dates.size !== 1) return bucket
  return HOURLY_BUCKET.exec(bucket)?.[2] ?? bucket
}

export function buildPortalTimeSeries(
  rows: PortalBillingRow[],
  start: Date,
  end: Date,
  unknownLabel: string,
): PortalBillingBarPoint[] {
  const granularity = granularityForBillingRange(start, end)
  const totals = new Map<string, number>()
  const seriesNames = new Set<string>()

  for (const row of rows) {
    const series = modelNameForBillingRow(row, unknownLabel)
    seriesNames.add(series)
    const bucket = formatChartTime(row.created_at, granularity)
    const key = `${bucket}\0${series}`
    totals.set(key, (totals.get(key) ?? 0) + (Number(row.quota) || 0))
  }

  const buckets = listBillingBuckets(start, end, granularity)
  const names = [...seriesNames].sort((a, b) => a.localeCompare(b))
  if (names.length === 0) names.push(unknownLabel)

  const points: PortalBillingBarPoint[] = []
  for (const bucket of buckets) {
    for (const series of names) {
      points.push({
        bucket,
        series,
        quota: totals.get(`${bucket}\0${series}`) ?? 0,
      })
    }
  }
  return points
}

export function buildPortalBillingCsv(points: PortalBillingBarPoint[]): string {
  const header = 'bucket,series,quota'
  const lines = points.map((point) => {
    const bucket = /[",\n]/.test(point.bucket)
      ? `"${point.bucket.replaceAll('"', '""')}"`
      : point.bucket
    const series = /[",\n]/.test(point.series)
      ? `"${point.series.replaceAll('"', '""')}"`
      : point.series
    return `${bucket},${series},${point.quota}`
  })
  return [header, ...lines].join('\n')
}

function listBillingBuckets(
  start: Date,
  end: Date,
  granularity: TimeGranularity,
): string[] {
  const buckets: string[] = []
  let cursor = dayjs(start)
  const last = dayjs(end)
  let step: TimeGranularity = 'day'
  if (granularity === 'hour') step = 'hour'
  if (granularity === 'week') step = 'week'

  while (cursor.isBefore(last) || cursor.isSame(last, step)) {
    buckets.push(formatChartTime(Math.floor(cursor.valueOf() / 1000), granularity))
    cursor = cursor.add(1, step)
    if (buckets.length > 400) break
  }
  return buckets
}
