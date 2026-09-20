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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import type { ReactElement } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { apiKeySchema } from '@/features/keys/types'
import { usageLogSchema } from '@/features/usage-logs/data/schema'

import { PortalKeysPanel } from '../components/portal-keys-panel'
import { PortalLogsPanel } from '../components/portal-logs-panel'

const getApiKeys = vi.hoisted(() => vi.fn())
const getTokenAutoGroups = vi.hoisted(() => vi.fn())
const getUserGroups = vi.hoisted(() => vi.fn())
const getUserModels = vi.hoisted(() => vi.fn())
const getUserLogs = vi.hoisted(() => vi.fn())
const getUserLogStats = vi.hoisted(() => vi.fn())

vi.mock('@/features/keys/api', () => ({
  getApiKeys,
  searchApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  updateApiKeyStatus: vi.fn(),
  fetchTokenKey: vi.fn(),
  getTokenAutoGroups,
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, getUserGroups, getUserModels }
})

vi.mock('@/features/usage-logs/api', () => ({
  getUserLogs,
  getUserLogStats,
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({
    status: { default_use_auto_group: false },
    loading: false,
  }),
}))

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

const clients: QueryClient[] = []

function renderPanel(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </I18nextProvider>
  )
}

afterEach(() => {
  for (const client of clients) client.clear()
  clients.length = 0
  vi.clearAllMocks()
})

describe('portal console pages', () => {
  test('does not embed the admin key or log tables', () => {
    const keys = readFileSync(
      resolve(
        process.cwd(),
        'src/features/user-portal/components/user-portal-api-keys.tsx'
      ),
      'utf8'
    )
    const logs = readFileSync(
      resolve(
        process.cwd(),
        'src/features/user-portal/components/user-portal-logs.tsx'
      ),
      'utf8'
    )
    expect(keys).not.toContain('ApiKeysTable')
    expect(keys).not.toContain('ApiKeysProvider')
    expect(logs).not.toContain('UsageLogsTable')
    expect(logs).not.toContain('UsageLogsProvider')
  })

  test('renders API keys as portal cards instead of the admin table', async () => {
    getApiKeys.mockResolvedValue({
      success: true,
      data: {
        items: [
          apiKeySchema.parse({
            id: 7,
            name: 'production',
            key: 'demo********1234',
            status: 1,
            remain_quota: 40_000_000,
            used_quota: 0,
            unlimited_quota: true,
            expired_time: -1,
            created_time: 1_700_000_000,
            accessed_time: 0,
            group: 'vip',
            model_limits_enabled: false,
          }),
        ],
        total: 1,
        page: 1,
        page_size: 20,
      },
    })

    renderPanel(<PortalKeysPanel />)

    expect(
      await screen.findByRole('heading', { name: 'Key Management' })
    ).toBeInTheDocument()
    expect(await screen.findByText('production')).toBeInTheDocument()
    expect(screen.getByText('sk-demo********1234')).toBeInTheDocument()
    expect(screen.getByText('vip')).toBeInTheDocument()
    expect(getApiKeys).toHaveBeenCalled()
    expect(screen.queryByRole('table')).toBeNull()
  })

  test('lets the user search groups when creating a key', async () => {
    getApiKeys.mockResolvedValue({
      success: true,
      data: {
        items: [
          apiKeySchema.parse({
            id: 7,
            name: 'production',
            key: 'demo********1234',
            status: 1,
            remain_quota: 0,
            used_quota: 0,
            unlimited_quota: true,
            expired_time: -1,
            created_time: 1_700_000_000,
            accessed_time: 0,
            group: 'default',
            model_limits_enabled: false,
          }),
        ],
        total: 1,
        page: 1,
        page_size: 20,
      },
    })
    getUserGroups.mockResolvedValue({
      success: true,
      data: {
        default: { desc: 'User group', ratio: 1 },
        vip: { desc: 'Priority group', ratio: 3 },
      },
    })
    getTokenAutoGroups.mockResolvedValue({
      success: true,
      data: { groups: ['default', 'vip'], max_count: 5 },
    })

    const user = userEvent.setup()
    renderPanel(<PortalKeysPanel />)
    await user.click(
      await screen.findByRole('button', { name: 'Create API Key' })
    )

    await user.click(await screen.findByRole('combobox'))
    expect(await screen.findByPlaceholderText('Search...')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Search...'), 'vip')
    const visibleGroups = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]'),
    ].map((item) => item.textContent ?? '')
    expect(visibleGroups.some((text) => text.includes('vip'))).toBe(true)
    expect(visibleGroups.some((text) => text.includes('default'))).toBe(false)
  })

  test('renders request logs as a portal table instead of the admin table', async () => {
    getUserModels.mockResolvedValue({
      success: true,
      data: ['claude-sonnet', 'gpt-4.1', 'gpt-4o'],
    })
    getUserLogs.mockResolvedValue({
      success: true,
      data: {
        items: [
          usageLogSchema.parse({
            id: 9,
            user_id: 1,
            created_at: 1_700_000_000,
            type: 2,
            content: 'ok',
            username: 'alice',
            token_name: 'production',
            model_name: 'gpt-4.1',
            quota: 120,
            prompt_tokens: 10,
            completion_tokens: 20,
            use_time: 1,
            is_stream: true,
            channel: 3,
            token_id: 7,
            group: '',
            ip: '127.0.0.1',
            other: JSON.stringify({
              cache_tokens: 5,
              model_ratio: 0.075,
              completion_ratio: 4,
              group_ratio: 1,
            }),
            request_id: 'req_1',
            upstream_request_id: '',
          }),
        ],
        total: 1,
        page: 1,
        page_size: 20,
      },
    })
    getUserLogStats.mockResolvedValue({
      success: true,
      data: { quota: 120, rpm: 1, tpm: 30 },
    })

    renderPanel(<PortalLogsPanel />)

    expect(
      await screen.findByRole('heading', { name: 'Request Logs' })
    ).toBeInTheDocument()
    expect(await screen.findByText('gpt-4.1')).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Input' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Cache' })
    ).toBeInTheDocument()
    expect(screen.getAllByText('Stream').length).toBeGreaterThan(1)
    expect(screen.getByText('20 t/s')).toBeInTheDocument()
    expect(screen.getByText('1.0s')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('cell', { name: 'gpt-4.1' }))
    await waitFor(() => {
      expect(screen.getByText('req_1')).toBeInTheDocument()
    })
    expect(screen.getByText('Cost formula')).toBeInTheDocument()
    expect(screen.getByText(/Per-token/)).toBeInTheDocument()
    expect(screen.getByText(/Group Ratio/)).toBeInTheDocument()
    expect(screen.getByText(/\/M/)).toBeInTheDocument()
  })

  test('filters the model list by prefix without requiring the full name', async () => {
    getUserModels.mockResolvedValue({
      success: true,
      data: ['claude-sonnet', 'gpt-4.1', 'gpt-4o'],
    })
    getUserLogs.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, page_size: 20 },
    })
    getUserLogStats.mockResolvedValue({
      success: true,
      data: { quota: 0, rpm: 0, tpm: 0 },
    })

    const user = userEvent.setup()
    renderPanel(<PortalLogsPanel />)

    await user.click(await screen.findByRole('combobox', { name: 'Model' }))
    expect(await screen.findByPlaceholderText('Search...')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Search...'), 'gpt')
    const visibleModels = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]'),
    ].map((item) => item.textContent ?? '')
    expect(visibleModels.some((text) => text.includes('gpt-4.1'))).toBe(true)
    expect(visibleModels.some((text) => text.includes('gpt-4o'))).toBe(true)
    expect(visibleModels.some((text) => text.includes('claude-sonnet'))).toBe(
      false
    )

    await user.click(screen.getByRole('option', { name: 'gpt-4o' }))
    await waitFor(() => {
      expect(getUserLogs).toHaveBeenCalledWith(
        expect.objectContaining({ model_name: 'gpt-4o' })
      )
    })
  })

  test('lets the user filter request logs by date and time', async () => {
    getUserModels.mockResolvedValue({
      success: true,
      data: ['gpt-4.1'],
    })
    getUserLogs.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, page_size: 20 },
    })
    getUserLogStats.mockResolvedValue({
      success: true,
      data: { quota: 0, rpm: 0, tpm: 0 },
    })

    const user = userEvent.setup()
    renderPanel(<PortalLogsPanel />)

    await user.click(
      await screen.findByRole('button', {
        name: /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/,
      })
    )
    const startInput = await screen.findByLabelText('Start Time')
    const endInput = screen.getByLabelText('End Time')
    expect(startInput).toHaveAttribute('type', 'datetime-local')
    expect(endInput).toHaveAttribute('type', 'datetime-local')

    fireEvent.change(startInput, { target: { value: '2026-09-20T08:15' } })
    fireEvent.change(endInput, { target: { value: '2026-09-20T18:30' } })
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(getUserLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          start_timestamp: Math.floor(
            new Date(2026, 8, 20, 8, 15).getTime() / 1000
          ),
          end_timestamp: Math.floor(
            new Date(2026, 8, 20, 18, 30).getTime() / 1000
          ),
        })
      )
    })
  })
})
