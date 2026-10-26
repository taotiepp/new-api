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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { VirtualGroupsPage } from '../index'

const catalog = [
  {
    name: 'alias',
    models: [
      {
        name: 'gpt-4o',
        source_group: 'default',
        source_model: 'gpt-4o',
        redirect: '',
      },
    ],
  },
  { name: 'spare', models: [] },
]

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <VirtualGroupsPage />
      <Toaster />
    </QueryClientProvider>
  )
}

describe('virtual groups page', () => {
  beforeEach(() => {
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url === '/api/user/self/virtual-groups') {
        return { data: { success: true, data: catalog } }
      }
      if (url === '/api/user/self/groups') {
        return {
          data: {
            success: true,
            data: {
              default: { desc: 'Default', ratio: 0.4 },
              auto: { desc: 'Auto', ratio: 1 },
              mirrored: { desc: 'Mirror', ratio: 1, virtual: true },
            },
          },
        }
      }
      if (url === '/api/user/models') {
        return {
          data: { success: true, data: ['gpt-4o', 'claude-3', 'gemini'] },
        }
      }
      throw new Error(`unexpected ${String(url)}`)
    })
    vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
  })

  it('shows the saved groups as a list until one is opened', async () => {
    renderPage()

    expect(await screen.findByText('alias')).toBeVisible()
    expect(screen.getByText('spare')).toBeVisible()
    expect(screen.getByText('gpt-4o')).toBeVisible()
    expect(
      screen.queryByRole('textbox', { name: 'Public name' })
    ).not.toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveClass('sm:flex-row')
    expect(within(rows[0]).getByText('alias')).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Edit alias' }))

    expect(screen.getByRole('columnheader', { name: 'Alias' })).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: 'Actual model' })
    ).toBeVisible()
    expect(
      screen.getByRole('columnheader', { name: 'Group rate' })
    ).toBeVisible()
    expect(screen.getByText('×0.4')).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: /Alias for default/ })
    ).toHaveValue('gpt-4o')
    expect(screen.getByText('default / gpt-4o')).toBeVisible()
    expect(
      screen.queryByRole('textbox', { name: 'Redirect' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Edit group')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Edit spare' })
    ).not.toBeInTheDocument()
  })

  it('adds every selected source model from one action and returns to the list', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: 'Edit alias' })
    await user.click(screen.getByRole('button', { name: 'Add group' }))

    await user.click(screen.getByRole('combobox', { name: 'Source group' }))
    expect(
      await screen.findByRole('option', { name: 'default · Default ×0.4' })
    ).toBeVisible()
    expect(
      screen.queryByRole('option', { name: /auto/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: /mirrored/ })
    ).not.toBeInTheDocument()
    await user.keyboard('{Escape}')

    await user.type(
      screen.getByRole('textbox', { name: 'Group name' }),
      'bundle'
    )
    await user.click(screen.getByRole('combobox', { name: 'Select models' }))
    await user.click(await screen.findByRole('option', { name: 'claude-3' }))
    await user.click(await screen.findByRole('option', { name: 'gemini' }))
    await user.keyboard('{Escape}')
    await user.click(
      screen.getByRole('button', { name: 'Add selected models' })
    )

    expect(
      screen.getByRole('textbox', { name: /Alias for default .* claude-3/ })
    ).toHaveValue('claude-3')
    expect(
      screen.getByRole('textbox', { name: /Alias for default .* gemini/ })
    ).toHaveValue('gemini')
    expect(screen.getByText('default / claude-3')).toBeVisible()
    expect(screen.getByText('default / gemini')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Add model' })
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    const bundle = (
      await screen.findByRole('button', { name: 'Edit bundle' })
    ).closest('li')
    expect(bundle).toHaveTextContent('claude-3')
    expect(bundle).toHaveTextContent('gemini')
    expect(
      screen.queryByRole('columnheader', { name: 'Alias' })
    ).not.toBeInTheDocument()
    expect(api.put).toHaveBeenCalledWith(
      '/api/user/self/virtual-groups',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'bundle',
          models: [
            expect.objectContaining({
              name: 'claude-3',
              source_model: 'claude-3',
            }),
            expect.objectContaining({ name: 'gemini', source_model: 'gemini' }),
          ],
        }),
      ])
    )
  })

  it('discards a new group when the card is cancelled', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: 'Add group' })
    await user.click(screen.getByRole('button', { name: 'Add group' }))
    await user.type(
      screen.getByRole('textbox', { name: 'Group name' }),
      'bundle'
    )
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('bundle')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit alias' })).toBeVisible()
  })

  it('asks before removing a group from the list', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Remove spare' })
    )
    expect(screen.getByText('Remove virtual group')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(screen.queryByText('spare')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Edit alias' })).toBeVisible()
    expect(api.put).toHaveBeenCalledWith('/api/user/self/virtual-groups', [
      expect.objectContaining({ name: 'alias' }),
    ])
  })

  it('keeps the open card when the group name is duplicated', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: 'Edit alias' })
    await user.click(screen.getByRole('button', { name: 'Add group' }))
    await user.type(
      await screen.findByRole('textbox', { name: 'Group name' }),
      'alias'
    )
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByText('Virtual group name is duplicated')
    ).toBeVisible()
    expect(api.put).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Group name' })).toHaveValue(
      'alias'
    )
    expect(
      screen.queryByRole('button', { name: 'Edit spare' })
    ).not.toBeInTheDocument()
  })

  it('saves several aliases that all use the same source model', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Edit alias' }))
    await user.click(
      screen.getByRole('button', { name: /Add an alias for default/ })
    )
    const aliasInputs = screen.getAllByRole('textbox', {
      name: /Alias for default/,
    })
    expect(aliasInputs[1]).toHaveValue('')
    expect(screen.getAllByText('default / gpt-4o')).toHaveLength(2)
    await user.type(aliasInputs[1], 'gpt-5.6-luna')
    await user.click(
      screen.getAllByRole('button', {
        name: /Add an alias for default/,
      })[1]
    )
    const nextInputs = screen.getAllByRole('textbox', {
      name: /Alias for default/,
    })
    await user.type(nextInputs[2], 'gpt-6-luna')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByRole('button', { name: 'Edit alias' })
    expect(api.put).toHaveBeenCalledWith(
      '/api/user/self/virtual-groups',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'alias',
          models: [
            expect.objectContaining({
              name: 'gpt-4o',
              source_group: 'default',
              source_model: 'gpt-4o',
              redirect: '',
            }),
            expect.objectContaining({
              name: 'gpt-5.6-luna',
              source_group: 'default',
              source_model: 'gpt-4o',
              redirect: '',
            }),
            expect.objectContaining({
              name: 'gpt-6-luna',
              source_group: 'default',
              source_model: 'gpt-4o',
              redirect: '',
            }),
          ],
        }),
      ])
    )
  })

  it('omits a blank alias row when the group is saved', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Edit alias' }))
    await user.click(
      screen.getByRole('button', { name: /Add an alias for default/ })
    )
    expect(
      screen.getAllByRole('textbox', { name: /Alias for default/ })[1]
    ).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByRole('button', { name: 'Edit alias' })
    expect(api.put).toHaveBeenCalledWith(
      '/api/user/self/virtual-groups',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'alias',
          models: [
            expect.objectContaining({
              name: 'gpt-4o',
              source_group: 'default',
              source_model: 'gpt-4o',
            }),
          ],
        }),
      ])
    )
  })

  it('saves the open editor without returning to the list first', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Edit alias' }))
    const name = screen.getByRole('textbox', { name: 'Group name' })
    await user.clear(name)
    await user.type(name, 'alias-2')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByRole('button', { name: 'Edit alias-2' })
    ).toBeVisible()
    expect(api.put).toHaveBeenCalledWith(
      '/api/user/self/virtual-groups',
      expect.arrayContaining([
        expect.objectContaining({
          name: 'alias-2',
          models: [
            expect.objectContaining({
              name: 'gpt-4o',
              source_group: 'default',
              source_model: 'gpt-4o',
            }),
          ],
        }),
      ])
    )
  })
})
