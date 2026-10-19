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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import type { ReactElement, ReactNode } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { PortalBillPanel } from '../components/portal-bill-panel'
import { PortalLogsPanel } from '../components/portal-logs-panel'

const getUserBills = vi.hoisted(() => vi.fn())
const listUserInvoices = vi.hoisted(() => vi.fn())
const issueUserInvoice = vi.hoisted(() => vi.fn())
const getUserLogs = vi.hoisted(() => vi.fn())
const getUserLogStats = vi.hoisted(() => vi.fn())
const getUserModels = vi.hoisted(() => vi.fn())
const searchUsers = vi.hoisted(() => vi.fn())
const searchApiKeys = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: ReactNode; className?: string }) => (
    <a className={props.className} href={props.to}>
      {props.children}
    </a>
  ),
}))

vi.mock('@visactor/react-vchart', () => ({
  VChart: () => null,
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: { system_name: 'Test' }, loading: false }),
}))

vi.mock('@/features/dashboard/api', () => ({
  getUserBills,
  listUserInvoices,
  issueUserInvoice,
  getUserQuotaDates: vi.fn(),
}))

vi.mock('@/features/usage-logs/api', () => ({
  getUserLogs,
  getUserLogStats,
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, getUserModels }
})

vi.mock('@/features/users/api', () => ({
  searchUsers,
}))

vi.mock('@/features/keys/api', () => ({
  searchApiKeys,
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

function signIn(role: number) {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'alice',
    role,
  })
}

afterEach(() => {
  for (const client of clients) client.clear()
  clients.length = 0
  useAuthStore.getState().auth.reset()
  vi.clearAllMocks()
})

describe('portal subject user', () => {
  test('administrator can load another user request logs', async () => {
    signIn(ROLE.ADMIN)
    getUserModels.mockResolvedValue({ success: true, data: ['gpt-4.1'] })
    getUserLogs.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, page_size: 20 },
    })
    getUserLogStats.mockResolvedValue({
      success: true,
      data: { quota: 0, rpm: 0, tpm: 0 },
    })
    searchUsers.mockResolvedValue({
      success: true,
      data: {
        items: [{ id: 2, username: 'bob' }],
        total: 1,
        page: 1,
        page_size: 8,
      },
    })
    searchApiKeys.mockResolvedValue({
      success: true,
      data: {
        items: [{ id: 9, name: 'bob-production' }],
        total: 1,
        page: 1,
        page_size: 8,
      },
    })

    const user = userEvent.setup()
    renderPanel(<PortalLogsPanel />)

    await user.click(await screen.findByRole('combobox', { name: 'User' }))
    await user.type(
      screen.getByPlaceholderText('Search by username or email...'),
      'bob'
    )
    await user.click(await screen.findByRole('option', { name: /bob/ }))

    expect(await screen.findByText('Viewing bob')).toBeInTheDocument()
    await waitFor(() => {
      expect(getUserLogs).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 2 })
      )
      expect(getUserLogStats).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 2 })
      )
    })

    await user.click(screen.getByRole('combobox', { name: 'API Key' }))
    await user.type(screen.getByPlaceholderText('Search...'), 'bob')
    await user.click(
      await screen.findByRole('option', { name: 'bob-production' })
    )

    await waitFor(() => {
      expect(searchApiKeys).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: '%bob%', user_id: 2 })
      )
      expect(getUserLogs).toHaveBeenCalledWith(
        expect.objectContaining({ token_name: 'bob-production', user_id: 2 })
      )
    })
  })

  test('common user does not see another user logs picker', async () => {
    signIn(ROLE.USER)
    getUserModels.mockResolvedValue({ success: true, data: [] })
    getUserLogs.mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, page_size: 20 },
    })
    getUserLogStats.mockResolvedValue({
      success: true,
      data: { quota: 0, rpm: 0, tpm: 0 },
    })

    renderPanel(<PortalLogsPanel />)

    expect(
      await screen.findByRole('heading', { name: 'Request Logs' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'User' })).toBeNull()
    await waitFor(() => {
      expect(getUserLogs).toHaveBeenCalled()
    })
    expect(getUserLogs.mock.calls[0]?.[0]).not.toEqual(
      expect.objectContaining({ user_id: expect.any(Number) })
    )
  })

  test('administrator can load another user bills', async () => {
    signIn(ROLE.ADMIN)
    listUserInvoices.mockResolvedValue({
      success: true,
      data: {
        invoices: [],
        uninvoiced: { quota: 80, count: 4, token_used: 8, items: [] },
      },
    })
    getUserBills.mockResolvedValue({
      success: true,
      data: {
        period: '2026-10',
        quota: 80,
        count: 4,
        token_used: 8,
        items: [],
        trend: [],
      },
    })
    searchUsers.mockResolvedValue({
      success: true,
      data: {
        items: [{ id: 2, username: 'bob' }],
        total: 1,
        page: 1,
        page_size: 8,
      },
    })

    const user = userEvent.setup()
    renderPanel(<PortalBillPanel />)

    await user.click(await screen.findByRole('combobox', { name: 'User' }))
    await user.type(
      screen.getByPlaceholderText('Search by username or email...'),
      'bob'
    )
    await user.click(await screen.findByRole('option', { name: /bob/ }))

    expect(await screen.findByText('Viewing bob')).toBeInTheDocument()
    await waitFor(() => {
      expect(getUserBills).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 2 })
      )
    })
  })
})
