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
  PORTAL_BILLING_ALL_KEYS,
  buildPortalBillingCsv,
  buildPortalCategorySeries,
  buildPortalTimeSeries,
  createDefaultPortalBillingRange,
  filterFlowRowsByTokenId,
  formatPortalBillingRangeLabel,
  granularityForBillingRange,
  isDefaultPortalBillingRange,
  isPortalBillingRangeTooLong,
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

  test('treats today plus all keys and model grouping as the default filter state', () => {
    const now = new Date('2026-09-17T15:30:00')
    const range = createDefaultPortalBillingRange(now)
    expect(
      isDefaultPortalBillingRange(
        range.start,
        range.end,
        PORTAL_BILLING_ALL_KEYS,
        'model',
        now,
      ),
    ).toBe(true)
    expect(
      isDefaultPortalBillingRange(
        range.start,
        range.end,
        '12',
        'model',
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

  test('keeps only the selected API key in flow rows', () => {
    const rows = [
      { token_id: 1, token_name: 'prod', quota: 10 },
      { token_id: 2, token_name: 'dev', quota: 4 },
    ]
    expect(filterFlowRowsByTokenId(rows, null)).toHaveLength(2)
    expect(filterFlowRowsByTokenId(rows, 2).map((row) => row.token_name)).toEqual(
      ['dev'],
    )
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

  test('ranks API keys by quota for the category chart', () => {
    expect(
      buildPortalCategorySeries(
        [
          { token_id: 1, token_name: 'prod', quota: 3 },
          { token_id: 1, token_name: 'prod', quota: 7 },
          { token_id: 2, token_name: 'dev', quota: 20 },
        ],
        (row) => row.token_name || 'Unknown',
      ),
    ).toEqual([
      { bucket: 'dev', series: 'dev', quota: 20 },
      { bucket: 'prod', series: 'prod', quota: 10 },
    ])
  })

  test('exports quoted CSV when a series name contains a comma', () => {
    expect(
      buildPortalBillingCsv([
        { bucket: '09-17 15:00', series: 'gpt-4,preview', quota: 12 },
      ]),
    ).toBe('bucket,series,quota\n09-17 15:00,"gpt-4,preview",12')
  })
})
