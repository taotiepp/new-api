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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import type { ReactElement } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { PortalSettingsPanel } from '../components/portal-settings-panel'

const getUserProfile = vi.hoisted(() => vi.fn())
const testUserNotification = vi.hoisted(() => vi.fn())

vi.mock('@/features/profile/api', () => ({
  getUserProfile,
  updateUserSettings: vi.fn(),
  testUserNotification,
  updateUserLanguage: vi.fn(),
}))

vi.mock('@/lib/currency', () => ({
  currencyAmountFromQuota: () => 1,
  quotaFromCurrencyAmount: () => 500000,
  usePricingCurrency: () => ({
    currency: 'USD',
    exchangeRate: 1,
    quotaPerUnit: 500000,
    formatQuota: (quota: number) => `quota:${quota}`,
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

describe('portal settings', () => {
  test('does not embed the old profile console', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/user-portal/components/user-portal-settings.tsx'
      ),
      'utf8'
    )
    expect(source).not.toContain('Profile')
    expect(source).toContain('PortalSettingsPanel')
  })

  test('shows the account, Chinese and English, and the webhook contract', async () => {
    getUserProfile.mockResolvedValue({
      success: true,
      data: {
        id: 3,
        username: 'ada',
        display_name: 'Ada Lovelace',
        role: 1,
        email: 'ada@example.com',
        group: 'vip',
        quota: 1_000_000,
        used_quota: 250_000,
        request_count: 42,
        aff_count: 0,
        aff_quota: 0,
        aff_history_quota: 0,
        created_time: 1,
        setting: JSON.stringify({
          notify_type: 'email',
          quota_warning_threshold: 500000,
          language: 'en',
        }),
      },
    })
    testUserNotification.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    renderPanel(<PortalSettingsPanel />)

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('Current Balance')).toBeInTheDocument()
    expect(screen.getByText('quota:1000000')).toBeInTheDocument()
    expect(screen.getByText('Total Usage')).toBeInTheDocument()
    expect(screen.getByText('quota:250000')).toBeInTheDocument()
    expect(screen.getByText('Total requests')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Simplified Chinese' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Français' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Generic webhook' }))
    expect(screen.getByText('POST')).toBeInTheDocument()
    expect(screen.getByText('application/json')).toBeInTheDocument()
    expect(screen.getByText(/"type": "quota_exceed"/)).toBeInTheDocument()
    expect(screen.getByText(/X-Webhook-Signature/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Send test message' }))
    await waitFor(() => {
      expect(testUserNotification).toHaveBeenCalled()
    })
  })
})
