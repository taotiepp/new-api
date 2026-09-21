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
import { describe, expect, test } from 'vitest'

import {
  PORTAL_BILL_MAX_RANGE_SECONDS,
  PORTAL_BILLING_ALL_MODELS,
  PORTAL_BILLING_CHART_COLORS,
  buildPortalBillingCsv,
  buildPortalBillStatementCsv,
  buildPortalCostTrend,
  buildPortalInvoiceDate,
  buildPortalInvoiceNumber,
  buildPortalTimeSeries,
  compactPortalBillingAxisLabel,
  createDefaultPortalBillingRange,
  createPortalBillMonthRange,
  filterRowsByModelName,
  formatPortalBillingRangeLabel,
  granularityForBillingRange,
  isDefaultPortalBillingRange,
  isPortalBillingRangeTooLong,
  listPortalBillMonths,
  listPortalBillingModels,
  summarizePortalBillingByModel,
  sumPortalBillingStats,
} from '../lib/billing'

describe('portal billing aggregations', () => {
  test('sums quota, request count, and tokens from empty and mixed rows', () => {
    expect(sumPortalBillingStats([])).toEqual({
      quota: 0,
      count: 0,
      tokens: 0,
    })
    expect(
      sumPortalBillingStats([
        { quota: 100, count: 2, token_used: 10 },
        { quota: 50, count: 3, token_used: 5 },
      ]),
    ).toEqual({ quota: 150, count: 5, tokens: 15 })
  })

  test('uses hourly buckets for a one-day range and daily buckets for a week', () => {
    const start = new Date('2026-09-17T00:00:00')
    expect(
      granularityForBillingRange(start, new Date('2026-09-17T23:59:59')),
    ).toBe('hour')
    expect(
      granularityForBillingRange(start, new Date('2026-09-24T00:00:00')),
    ).toBe('day')
  })

  test('rejects ranges longer than 30 days', () => {
    const start = new Date('2026-09-01T00:00:00')
    expect(
      isPortalBillingRangeTooLong(start, new Date('2026-09-20T00:00:00')),
    ).toBe(false)
    expect(
      isPortalBillingRangeTooLong(start, new Date('2026-10-05T00:00:00')),
    ).toBe(true)
  })

  test('allows a 31-day calendar month when the bill range limit is used', () => {
    const start = new Date('2026-01-01T00:00:00')
    const end = new Date('2026-01-31T23:59:59')
    expect(isPortalBillingRangeTooLong(start, end)).toBe(true)
    expect(
      isPortalBillingRangeTooLong(start, end, PORTAL_BILL_MAX_RANGE_SECONDS),
    ).toBe(false)
  })

  test('builds a month range that stops at today for the current month', () => {
    const now = new Date('2026-09-17T15:30:00')
    const current = createPortalBillMonthRange(now, now)
    expect(current.start.getDate()).toBe(1)
    expect(current.end.getDate()).toBe(17)
    const past = createPortalBillMonthRange(new Date('2026-01-10T12:00:00'), now)
    expect(past.start.getMonth()).toBe(0)
    expect(past.end.getDate()).toBe(31)
  })

  test('lists recent billing months newest first', () => {
    expect(
      listPortalBillMonths(new Date('2026-09-17T15:30:00'), 3).map(
        (month) => month.value,
      ),
    ).toEqual(['2026-09', '2026-08', '2026-07'])
  })

  test('ranks models by quota and folds the tail into Other models', () => {
    const rows = [
      {
        created_at: 1,
        model_name: 'gpt-4.1',
        quota: 40,
        count: 2,
        token_used: 8,
      },
      {
        created_at: 1,
        model_name: 'deepseek-flash',
        quota: 30,
        count: 3,
        token_used: 6,
      },
      {
        created_at: 1,
        model_name: 'claude-sonnet',
        quota: 20,
        count: 1,
        token_used: 4,
      },
      { created_at: 1, model_name: 'mini', quota: 10, count: 1, token_used: 2 },
    ]
    expect(
      summarizePortalBillingByModel(rows, 'Unknown', 'Other').map(
        (share) => share.model,
      ),
    ).toEqual(['gpt-4.1', 'deepseek-flash', 'claude-sonnet', 'mini'])
    const shares = summarizePortalBillingByModel(rows, 'Unknown', 'Other', 2)
    expect(shares.map((share) => share.model)).toEqual([
      'gpt-4.1',
      'deepseek-flash',
      'Other',
    ])
    expect(shares[2]).toMatchObject({ quota: 30, count: 2, tokens: 6 })
    expect(shares.reduce((sum, share) => sum + share.ratio, 0)).toBeCloseTo(1)
  })

  test('maps monthly bill totals into a six-month cost trend', () => {
    const now = new Date('2026-09-21T15:00:00')
    expect(
      buildPortalCostTrend(
        [
          { period: '2026-03', quota: 99 },
          { period: '2026-04', quota: 6 },
          { period: '2026-09', quota: 1 },
        ],
        'Cost',
        now,
      ),
    ).toEqual([
      { bucket: '2026-04', series: 'Cost', quota: 6 },
      { bucket: '2026-05', series: 'Cost', quota: 0 },
      { bucket: '2026-06', series: 'Cost', quota: 0 },
      { bucket: '2026-07', series: 'Cost', quota: 0 },
      { bucket: '2026-08', series: 'Cost', quota: 0 },
      { bucket: '2026-09', series: 'Cost', quota: 1 },
    ])
  })

  test('treats today plus all models as the default filter state', () => {
    const now = new Date('2026-09-17T15:30:00')
    const range = createDefaultPortalBillingRange(now)
    expect(
      isDefaultPortalBillingRange(
        range.start,
        range.end,
        PORTAL_BILLING_ALL_MODELS,
        now,
      ),
    ).toBe(true)
    expect(
      isDefaultPortalBillingRange(
        range.start,
        range.end,
        'deepseek-flash',
        now,
      ),
    ).toBe(false)
  })

  test('formats a same-day range as MM/DD - MM/DD', () => {
    expect(
      formatPortalBillingRangeLabel(
        new Date('2026-09-17T00:00:00'),
        new Date('2026-09-17T23:59:59'),
      ),
    ).toBe('09/17 - 09/17')
  })

  test('fills missing hourly buckets so a one-day chart keeps a full axis', () => {
    const start = new Date('2026-09-17T00:00:00')
    const end = new Date('2026-09-17T23:59:59')
    const points = buildPortalTimeSeries(
      [
        {
          created_at: Math.floor(new Date('2026-09-17T15:00:00').getTime() / 1000),
          model_name: 'deepseek-flash',
          quota: 8,
        },
      ],
      start,
      end,
      'Unknown',
    )
    const buckets = [...new Set(points.map((point) => point.bucket))]
    expect(buckets.length).toBeGreaterThanOrEqual(24)
    const hit = points.find(
      (point) =>
        point.series === 'deepseek-flash' && point.quota === 8,
    )
    expect(hit).toBeDefined()
    expect(points.every((point) => point.series === 'deepseek-flash')).toBe(
      true,
    )
  })

  test('builds a stable commercial invoice number and closed-month date', () => {
    expect(buildPortalInvoiceNumber('2026-08', 7)).toBe('INV-2026-08-0007')
    expect(buildPortalInvoiceDate('2026-08', new Date('2026-09-21T15:00:00'))).toBe(
      '2026-08-31',
    )
    expect(buildPortalInvoiceDate('2026-09', new Date('2026-09-21T15:00:00'))).toBe(
      '2026-09-21',
    )
  })

  test('exports a statement CSV with invoice disclaimer and totals', () => {
    expect(
      buildPortalBillStatementCsv({
        period: '2026-08',
        status: 'Paid',
        currency: 'USD',
        items: [
          { model_name: 'gpt-a,preview', quota: 120, count: 4, token_used: 40 },
        ],
        labels: {
          title: 'Invoice',
          disclaimer: 'Computer-generated invoice',
          period: 'Period',
          status: 'Status',
          currency: 'Currency',
          model: 'Model',
          tokens: 'Tokens',
          requests: 'Requests',
          quota: 'Quota',
          total: 'Total',
        },
      }),
    ).toBe(
      [
        '# Invoice',
        '# Computer-generated invoice',
        '# Period,2026-08',
        '# Status,Paid',
        '# Currency,USD',
        'Period,Model,Tokens,Requests,Quota',
        '2026-08,"gpt-a,preview",40,4,120',
        '2026-08,Total,40,4,120',
      ].join('\n'),
    )
  })

  test('exports quoted CSV when a series name contains a comma', () => {
    expect(
      buildPortalBillingCsv([
        { bucket: '09-17 15:00', series: 'gpt-4,preview', quota: 12 },
      ]),
    ).toBe('bucket,series,quota\n09-17 15:00,"gpt-4,preview",12')
  })

  test('lists unique model names and keeps only the selected model', () => {
    const rows = [
      { model_name: 'deepseek-flash', quota: 8 },
      { model_name: 'gpt-6-astra', quota: 3 },
      { model_name: 'deepseek-flash', quota: 2 },
      { quota: 1 },
    ]
    expect(listPortalBillingModels(rows, 'Unknown')).toEqual([
      'deepseek-flash',
      'gpt-6-astra',
      'Unknown',
    ])
    expect(filterRowsByModelName(rows, null, 'Unknown')).toHaveLength(4)
    expect(
      filterRowsByModelName(rows, 'deepseek-flash', 'Unknown').map(
        (row) => row.quota,
      ),
    ).toEqual([8, 2])
    expect(
      filterRowsByModelName(rows, 'Unknown', 'Unknown').map((row) => row.quota),
    ).toEqual([1])
  })

  test('compacts same-day hourly axis labels but keeps dated labels for multi-day ranges', () => {
    const sameDay = [
      '09-18 00:00',
      '09-18 08:00',
      '09-18 23:00',
    ]
    expect(compactPortalBillingAxisLabel('09-18 08:00', sameDay)).toBe('08:00')
    expect(
      compactPortalBillingAxisLabel('09-18 08:00', [
        '09-17 23:00',
        '09-18 08:00',
      ]),
    ).toBe('09-18 08:00')
    expect(
      compactPortalBillingAxisLabel('09-18', ['09-17', '09-18']),
    ).toBe('09-18')
  })

  test('keeps adjacent billing chart colors at least 40 degrees apart in hue', () => {
    for (let i = 0; i < PORTAL_BILLING_CHART_COLORS.length - 1; i++) {
      const delta = hueDistance(
        hexToHue(PORTAL_BILLING_CHART_COLORS[i]),
        hexToHue(PORTAL_BILLING_CHART_COLORS[i + 1]),
      )
      expect(delta).toBeGreaterThanOrEqual(40)
    }
  })
})

function hexToHue(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta === 0) return 0
  let hue = 0
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue *= 60
  if (hue < 0) hue += 360
  return hue
}

function hueDistance(a: number, b: number): number {
  const delta = Math.abs(a - b)
  return Math.min(delta, 360 - delta)
}
