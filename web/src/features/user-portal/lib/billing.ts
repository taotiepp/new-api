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
export const PORTAL_BILL_MAX_RANGE_SECONDS = 32 * 24 * 60 * 60
export const PORTAL_BILL_TREND_MONTHS = 6
export const PORTAL_BILL_MODEL_LIMIT = 8
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

export function isPortalBillingRangeTooLong(
  start: Date,
  end: Date,
  maxSeconds = PORTAL_BILLING_MAX_RANGE_SECONDS,
): boolean {
  return (end.getTime() - start.getTime()) / 1000 > maxSeconds
}

export type PortalBillMonth = {
  value: string
  date: Date
}

export type PortalModelShare = {
  model: string
  quota: number
  count: number
  tokens: number
  ratio: number
}

export function createPortalBillMonthRange(
  month = new Date(),
  now = new Date(),
): { start: Date; end: Date } {
  const start = getStartOfDay(dayjs(month).startOf('month').toDate())
  if (dayjs(month).isSame(now, 'month')) {
    return { start, end: getEndOfDay(now) }
  }
  return {
    start,
    end: getEndOfDay(dayjs(month).endOf('month').toDate()),
  }
}

export function listPortalBillMonths(
  now = new Date(),
  count = 12,
): PortalBillMonth[] {
  const months: PortalBillMonth[] = []
  for (let offset = 0; offset < count; offset++) {
    const date = dayjs(now).subtract(offset, 'month').startOf('month').toDate()
    months.push({
      value: dayjs(date).format('YYYY-MM'),
      date,
    })
  }
  return months
}

export function summarizePortalBillingByModel(
  rows: PortalBillingRow[],
  unknownLabel: string,
  othersLabel: string,
  limit = Number.POSITIVE_INFINITY,
): PortalModelShare[] {
  const totals = new Map<string, PortalBillingStats>()
  let quotaTotal = 0
  for (const row of rows) {
    const model = modelNameForBillingRow(row, unknownLabel)
    const current = totals.get(model) ?? { quota: 0, count: 0, tokens: 0 }
    current.quota += Number(row.quota) || 0
    current.count += Number(row.count) || 0
    current.tokens += Number(row.token_used) || 0
    totals.set(model, current)
    quotaTotal += Number(row.quota) || 0
  }

  const ranked = [...totals.entries()]
    .map(([model, stats]) => ({
      model,
      quota: stats.quota,
      count: stats.count,
      tokens: stats.tokens,
      ratio: quotaTotal > 0 ? stats.quota / quotaTotal : 0,
    }))
    .sort((a, b) => b.quota - a.quota)

  if (ranked.length <= limit) {
    return ranked
  }

  const head = ranked.slice(0, limit)
  const tail = ranked.slice(limit)
  const other = tail.reduce(
    (acc, item) => ({
      model: othersLabel,
      quota: acc.quota + item.quota,
      count: acc.count + item.count,
      tokens: acc.tokens + item.tokens,
      ratio: acc.ratio + item.ratio,
    }),
    { model: othersLabel, quota: 0, count: 0, tokens: 0, ratio: 0 },
  )
  return [...head, other]
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

export function buildPortalCostTrend(
  months: Array<{ period: string; quota: number }>,
  series: string,
  now = new Date(),
  count = PORTAL_BILL_TREND_MONTHS,
): PortalBillingBarPoint[] {
  const byPeriod = new Map(
    months.map((month) => [month.period, Number(month.quota) || 0]),
  )
  const points: PortalBillingBarPoint[] = []
  for (let offset = count - 1; offset >= 0; offset--) {
    const period = dayjs(now).subtract(offset, 'month').format('YYYY-MM')
    points.push({
      bucket: period,
      series,
      quota: byPeriod.get(period) ?? 0,
    })
  }
  return points
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

export function buildPortalInvoiceNumber(
  period: string,
  userId: number,
): string {
  const safePeriod = period.replaceAll(/[^0-9-]/g, '')
  const id = String(Math.max(0, Math.trunc(userId))).padStart(4, '0')
  return `INV-${safePeriod}-${id}`
}

export function buildPortalInvoiceDate(period: string, now = new Date()): string {
  const month = dayjs(period)
  if (!month.isValid()) return dayjs(now).format('YYYY-MM-DD')
  if (dayjs(now).isSame(month, 'month')) return dayjs(now).format('YYYY-MM-DD')
  return month.endOf('month').format('YYYY-MM-DD')
}

export type PortalBillStatementItem = {
  model_name: string
  quota: number
  count: number
  token_used: number
}

export type PortalBillStatementLabels = {
  title: string
  disclaimer: string
  period: string
  status: string
  currency: string
  model: string
  tokens: string
  requests: string
  quota: string
  total: string
}

export function buildPortalBillStatementCsv(input: {
  period: string
  status: string
  currency: string
  items: PortalBillStatementItem[]
  labels: PortalBillStatementLabels
}): string {
  const labels = input.labels
  const header = [
    labels.period,
    labels.model,
    labels.tokens,
    labels.requests,
    labels.quota,
  ]
    .map(csvCell)
    .join(',')
  const lines = input.items.map((item) =>
    [
      input.period,
      item.model_name,
      String(Number(item.token_used) || 0),
      String(Number(item.count) || 0),
      String(Number(item.quota) || 0),
    ]
      .map(csvCell)
      .join(','),
  )
  const totals = input.items.reduce(
    (acc, item) => ({
      quota: acc.quota + (Number(item.quota) || 0),
      count: acc.count + (Number(item.count) || 0),
      tokens: acc.tokens + (Number(item.token_used) || 0),
    }),
    { quota: 0, count: 0, tokens: 0 },
  )
  lines.push(
    [
      input.period,
      labels.total,
      String(totals.tokens),
      String(totals.count),
      String(totals.quota),
    ]
      .map(csvCell)
      .join(','),
  )
  return [
    `# ${labels.title}`,
    `# ${labels.disclaimer}`,
    `# ${labels.period},${csvCell(input.period)}`,
    `# ${labels.status},${csvCell(input.status)}`,
    `# ${labels.currency},${csvCell(input.currency)}`,
    header,
    ...lines,
  ].join('\n')
}

export function buildPortalBillingCsv(points: PortalBillingBarPoint[]): string {
  const header = 'bucket,series,quota'
  const lines = points.map((point) => {
    return `${csvCell(point.bucket)},${csvCell(point.series)},${point.quota}`
  })
  return [header, ...lines].join('\n')
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
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
