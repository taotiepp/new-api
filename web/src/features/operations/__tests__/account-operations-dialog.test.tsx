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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { AccountOperationsDialog } from '../components/account-operations-dialog'
import type { AccountOperations } from '../types'

const getAccountOperations = vi.fn()
const updateAccountOperations = vi.fn()

vi.mock('../api', () => ({
  getAccountOperations: (...args: unknown[]) => getAccountOperations(...args),
  updateAccountOperations: (...args: unknown[]) =>
    updateAccountOperations(...args),
}))

const settings: AccountOperations = {
  user_id: 2,
  username: 'bob',
  display_name: 'Bob',
  group: 'default',
  custom: false,
  groups: [
    {
      name: 'default',
      description: '默认分组',
      inherited: true,
      allowed: true,
      assigned: true,
      default_ratio: 1,
      discount: null,
    },
    {
      name: 'svip',
      description: 'svip',
      inherited: false,
      allowed: false,
      assigned: false,
      default_ratio: 1.5,
      discount: null,
    },
    {
      name: 'vip',
      description: 'vip分组',
      inherited: true,
      allowed: true,
      assigned: false,
      default_ratio: 0.5,
      discount: 0.4,
    },
  ],
}

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={client}>
      <AccountOperationsDialog
        account={{
          user_id: 2,
          username: 'bob',
          display_name: 'Bob',
          quota: 1,
          count: 1,
          token_used: 1,
        }}
        onClose={() => undefined}
      />
    </QueryClientProvider>
  )
  return view
}

function discountRow(name: string): HTMLElement {
  const row = screen.getByRole('row', { name: new RegExp(name) })
  return row
}

describe('account operations dialog', () => {
  beforeEach(() => {
    getAccountOperations.mockReset()
    updateAccountOperations.mockReset()
    getAccountOperations.mockResolvedValue(settings)
    updateAccountOperations.mockResolvedValue(undefined)
  })

  test('shows default and custom discounts only for groups the account can use', async () => {
    const user = userEvent.setup()
    renderDialog()

    expect(await screen.findByText('×0.5')).toBeInTheDocument()
    expect(screen.getByText('×1')).toBeInTheDocument()
    expect(screen.queryByText('×1.5')).not.toBeInTheDocument()
    expect(
      within(discountRow('vip')).getByRole('textbox', {
        name: 'Custom group discount for vip',
      })
    ).toHaveValue('0.4')
    expect(
      within(discountRow('default')).getByRole('textbox', {
        name: 'Custom group discount for default',
      })
    ).toHaveValue('')

    await user.click(
      screen.getByRole('switch', { name: 'Custom usable resource groups' })
    )
    expect(screen.queryByText('×1.5')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /^svip/ }))
    expect(screen.getByText('×1.5')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'vipvip分组' }))
    expect(screen.queryByText('×0.5')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateAccountOperations).toHaveBeenCalledWith(2, {
      custom: true,
      groups: ['default', 'svip'],
      discounts: { default: null, svip: null },
    })
  })
})
