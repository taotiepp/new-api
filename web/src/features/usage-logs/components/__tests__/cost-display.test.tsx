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
import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import type React from 'react'
import { beforeAll, describe, expect, test } from 'vitest'

import { formatLogQuota } from '@/lib/format'

import { LogCostDisplay } from '../log-cost-display'

function renderCost(
  props: React.ComponentProps<typeof LogCostDisplay>
): ReturnType<typeof render> {
  return render(<LogCostDisplay {...props} />)
}

function normalizedText(value: string | null): string {
  return (value ?? '').replaceAll(/\s/g, '')
}

describe('log cost display', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      Subscription: 'Subscription',
      'Deducted by subscription': 'Deducted by subscription',
      'Includes tool-call surcharge': 'Includes tool-call surcharge',
    })
  })

  test('keeps the regular cost visible and adds an accessible surcharge marker', () => {
    const rendered = renderCost({
      quota: 12500,
      other: {
        tool_surcharges: [{ name: 'lookup_customer', count: 1, price: 5 }],
      },
    })

    expect(
      normalizedText(rendered.container.textContent).includes(
        normalizedText(formatLogQuota(12500))
      )
    ).toBe(true)
    const marker = screen.getByRole('img', {
      name: 'Includes tool-call surcharge',
    })
    expect(marker).toHaveAttribute('data-tool-surcharge-indicator', 'true')
    expect(marker).toHaveAttribute('tabindex', '0')
  })

  test('shows channel cost and margin only when the ledger is requested', () => {
    i18next.addResourceBundle('en', 'translation', {
      'Channel cost': 'Channel cost',
      Margin: 'Margin',
    })
    const rendered = renderCost({
      quota: 10000,
      costQuota: 4000,
      showLedger: true,
      other: {},
    })
    expect(rendered.container.textContent).toContain('Channel cost')
    expect(rendered.container.textContent).toContain('Margin')

    const hidden = renderCost({
      quota: 10000,
      costQuota: 4000,
      other: {},
    })
    expect(hidden.container.textContent).not.toContain('Channel cost')
  })

  test('labels the applied customer discount and source', () => {
    i18next.addResourceBundle('en', 'translation', {
      'Model discount': 'Model discount',
    })
    const rendered = renderCost({
      quota: 8000,
      other: {
        user_discount: 0.8,
        user_discount_source: 'user_model',
      },
    })
    expect(rendered.container.textContent).toContain('0.8x')
    expect(rendered.container.textContent).toContain('Model discount')
  })

  test('keeps channel discount on the admin ledger only', () => {
    i18next.addResourceBundle('en', 'translation', {
      'Channel cost': 'Channel cost',
      Margin: 'Margin',
      'Channel default discount': 'Channel default discount',
      'Default discount': 'Default discount',
    })
    const other = {
      user_discount: 1,
      user_discount_source: 'user_default',
      admin_info: {
        channel_discount: 0.6,
        channel_discount_source: 'channel_default',
      },
    }
    const admin = renderCost({
      quota: 10000,
      costQuota: 6000,
      showLedger: true,
      other,
    })
    expect(admin.container.textContent).toContain('1x')
    expect(admin.container.textContent).toContain('Default discount')
    expect(admin.container.textContent).toContain('0.6x')
    expect(admin.container.textContent).toContain('Channel default discount')

    const user = renderCost({
      quota: 10000,
      costQuota: 6000,
      other,
    })
    expect(user.container.textContent).toContain('1x')
    expect(user.container.textContent).toContain('Default discount')
    expect(user.container.textContent).not.toContain('Channel default discount')
    expect(user.container.textContent).not.toContain('0.6x')
  })

  test('does not invent a discount when the snapshot is missing', () => {
    const rendered = renderCost({
      quota: 10000,
      other: { group_ratio: 0.8 },
    })
    expect(rendered.container.textContent).not.toContain('0.8x')
  })

  test('preserves the subscription badge and adds the same legacy surcharge marker', () => {
    renderCost({
      quota: 5000,
      other: {
        billing_source: 'subscription',
        web_search: true,
        web_search_call_count: 1,
        web_search_price: 10,
      },
    })

    expect(screen.getByText('Subscription')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Includes tool-call surcharge' })
    ).toHaveAttribute('data-tool-surcharge-indicator', 'true')
  })
})
