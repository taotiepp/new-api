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

const getUserBills = vi.hoisted(() => vi.fn())
const listUserInvoices = vi.hoisted(() => vi.fn())
const issueUserInvoice = vi.hoisted(() => vi.fn())

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

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
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
  useAuthStore.getState().auth.reset()
  vi.clearAllMocks()
})

describe('portal invoice history', () => {
  test('issues only the uninvoiced remainder and keeps the earlier invoice', async () => {
    useAuthStore.getState().auth.setUser({
      id: 7,
      username: 'ada',
      display_name: 'Ada',
      role: ROLE.USER,
    })
    getUserBills.mockResolvedValue({
      success: true,
      data: {
        period: '2026-10',
        quota: 150,
        count: 3,
        token_used: 55,
        items: [],
        trend: [],
      },
    })
    listUserInvoices.mockResolvedValue({
      success: true,
      data: {
        invoices: [
          {
            id: 1,
            number: 'INV-2026-10-0007-01',
            period: '2026-10',
            sequence: 1,
            quota: 100,
            count: 2,
            token_used: 40,
            created_at: 1_760_000_000,
            items: [
              {
                model_name: 'gpt-a',
                quota: 100,
                count: 2,
                token_used: 40,
              },
            ],
          },
        ],
        uninvoiced: {
          quota: 50,
          count: 1,
          token_used: 15,
          items: [
            { model_name: 'gpt-a', quota: 50, count: 1, token_used: 15 },
          ],
        },
      },
    })
    issueUserInvoice.mockResolvedValue({
      success: true,
      data: {
        id: 2,
        number: 'INV-2026-10-0007-02',
        period: '2026-10',
        sequence: 2,
        quota: 50,
        count: 1,
        token_used: 15,
        created_at: 1_760_100_000,
        items: [
          { model_name: 'gpt-a', quota: 50, count: 1, token_used: 15 },
        ],
        issuer: {
          name: 'Cursor',
          line1: '801 West End Avenue',
          line2: '',
          city: 'New York',
          region: 'New York',
          postal_code: '10025',
          country: 'United States',
          phone: '+1 831-425-9504',
          email: 'hi@cursor.com',
        },
        bill_to: {
          name: 'Ada Zhang',
          line1: 'zhongguandonglu',
          line2: 'haidian',
          city: 'Beijing',
          region: '',
          postal_code: '100010',
          country: 'China',
          phone: '',
          email: 'ada@example.com',
        },
      },
    })

    const user = userEvent.setup()
    renderPanel(<PortalBillPanel />)

    expect(await screen.findByText('Exportable balance')).toBeInTheDocument()
    expect(screen.getByText('Export records')).toBeInTheDocument()
    expect(await screen.findByText('INV-2026-10-0007-01')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Export invoice' }))

    expect(await screen.findByText('INV-2026-10-0007-02')).toBeInTheDocument()
    expect(screen.getByText('Ada Zhang')).toBeInTheDocument()
    expect(screen.getByText(/hi@cursor.com/)).toBeInTheDocument()
    expect(screen.getByText('INV-2026-10-0007-01')).toBeInTheDocument()
    await waitFor(() => {
      expect(issueUserInvoice).toHaveBeenCalledWith(
        expect.objectContaining({ period: expect.stringMatching(/^\d{4}-\d{2}$/) })
      )
    })
  })

  test('disables another export when nothing remains', async () => {
    useAuthStore.getState().auth.setUser({
      id: 7,
      username: 'ada',
      role: ROLE.USER,
    })
    getUserBills.mockResolvedValue({
      success: true,
      data: {
        period: '2026-10',
        quota: 100,
        count: 2,
        token_used: 40,
        items: [],
        trend: [],
      },
    })
    listUserInvoices.mockResolvedValue({
      success: true,
      data: {
        invoices: [
          {
            id: 1,
            number: 'INV-2026-10-0007-01',
            period: '2026-10',
            sequence: 1,
            quota: 100,
            count: 2,
            token_used: 40,
            created_at: 1_760_000_000,
            items: [],
          },
        ],
        uninvoiced: { quota: 0, count: 0, token_used: 0, items: [] },
      },
    })

    renderPanel(<PortalBillPanel />)

    expect(await screen.findByText('INV-2026-10-0007-01')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export invoice' })).toBeDisabled()
    expect(issueUserInvoice).not.toHaveBeenCalled()
  })

  test('links to billing details when the invoice profile is missing', async () => {
    useAuthStore.getState().auth.setUser({
      id: 7,
      username: 'ada',
      role: ROLE.USER,
    })
    getUserBills.mockResolvedValue({
      success: true,
      data: {
        period: '2026-10',
        quota: 20,
        count: 1,
        token_used: 4,
        items: [],
        trend: [],
      },
    })
    listUserInvoices.mockResolvedValue({
      success: true,
      data: {
        invoices: [],
        uninvoiced: { quota: 20, count: 1, token_used: 4, items: [] },
        bill_to_ready: false,
      },
    })

    renderPanel(<PortalBillPanel />)

    expect(
      await screen.findByText(
        'Set your billing details before exporting an invoice.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Set billing details' })).toHaveAttribute(
      'href',
      '/app/settings'
    )
    expect(screen.getByRole('button', { name: 'Export invoice' })).toBeDisabled()
    expect(issueUserInvoice).not.toHaveBeenCalled()
  })
})
