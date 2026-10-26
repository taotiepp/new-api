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
import type { ComponentProps } from 'react'
import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { PricingModel } from '@/features/pricing/types'
import { useAuthStore } from '@/stores/auth-store'

import { PortalModelGrid } from '../components/portal-model-grid'

const model: PricingModel = {
  id: 1,
  model_name: 'gpt-test',
  quota_type: 0,
  model_ratio: 0.5,
  completion_ratio: 3,
  cache_ratio: 0.1,
  enable_groups: ['vip'],
  context_length: 128_000,
}

function renderGrid(
  props: Partial<ComponentProps<typeof PortalModelGrid>> = {},
) {
  return render(
    <PortalModelGrid
      models={[model]}
      onModelClick={() => {}}
      selectedGroup={props.selectedGroup}
      groupRatio={props.groupRatio}
    />,
  )
}

describe('portal model square prices', () => {
  afterEach(() => {
    useAuthStore.getState().auth.reset()
  })

  it('shows list prices for input, output, and cache read without context', () => {
    renderGrid()
    expect(
      screen.getByRole('columnheader', { name: 'Input' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Output' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Cache Read' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('columnheader', { name: 'Context' }),
    ).not.toBeInTheDocument()

    const row = screen.getByText('gpt-test').closest('tr')
    expect(row).not.toBeNull()
    expect(row?.textContent).toMatch(/\$1\s*\/\s*1M/)
    expect(row?.textContent).toMatch(/\$3\s*\/\s*1M/)
    expect(row?.textContent).toMatch(/\$0\.1\s*\/\s*1M/)
    expect(row?.textContent).not.toContain('128K')
    expect(screen.queryByText(/^×/)).not.toBeInTheDocument()
  })

  it('keeps the list price and marks the selected group multiplier', () => {
    useAuthStore.getState().auth.setUser({
      id: 1,
      username: 'ada',
      role: 1,
      group_discounts: JSON.stringify({ vip: 0.4 }),
    })
    renderGrid({ selectedGroup: 'vip', groupRatio: { vip: 1 } })
    const row = screen.getByText('gpt-test').closest('tr') as HTMLElement
    expect(row.textContent).toMatch(/\$1\s*\/\s*1M/)
    expect(row.textContent).not.toMatch(/\$0\.4/)
    expect(within(row).getByText('×0.4')).toHaveAttribute(
      'aria-label',
      'Group price is 0.4 times the list price',
    )
  })

  it('uses a model discount in the selected group before the group default', () => {
    useAuthStore.getState().auth.setUser({
      id: 1,
      username: 'ada',
      role: 1,
      group_discounts: JSON.stringify({ vip: 0.4 }),
      group_model_discounts: JSON.stringify({ vip: { 'gpt-test': 0.25 } }),
    })
    renderGrid({ selectedGroup: 'vip', groupRatio: { vip: 0.8 } })
    expect(screen.getByText('×0.25')).toBeInTheDocument()
    expect(screen.getByText('gpt-test').closest('tr')?.textContent).toMatch(
      /\$1\s*\/\s*1M/,
    )
  })

  it('falls back to the group ratio when the user has no personal discount', () => {
    useAuthStore.getState().auth.setUser({
      id: 1,
      username: 'ada',
      role: 1,
    })
    renderGrid({ selectedGroup: 'vip', groupRatio: { vip: 1.5 } })
    expect(screen.getByText('×1.5')).toBeInTheDocument()
    expect(screen.getByText('gpt-test').closest('tr')?.textContent).toMatch(
      /\$3\s*\/\s*1M/,
    )
  })
})
