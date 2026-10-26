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
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import type { ReactElement } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useCatalogPricingCurrencyStore } from '@/stores/catalog-pricing-currency-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { PortalKeyUsageTable } from '../components/portal-key-usage-table'
import type { PortalKeyUsage } from '../lib/billing'

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

function renderTable(ui: ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

const rows: PortalKeyUsage[] = [
  { tokenId: 1, name: 'production', quota: 500000, count: 3, tokens: 12 },
  { tokenId: 2, name: 'staging', quota: 0, count: 1, tokens: 4 },
]

beforeEach(() => {
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  useCatalogPricingCurrencyStore.setState(
    useCatalogPricingCurrencyStore.getInitialState(),
    true
  )
})

afterEach(() => {
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  useCatalogPricingCurrencyStore.setState(
    useCatalogPricingCurrencyStore.getInitialState(),
    true
  )
})

describe('portal key usage table', () => {
  test('shows each key consumption, request count, and tokens', () => {
    renderTable(
      <PortalKeyUsageTable
        rows={rows}
        loading={false}
        error={false}
        onRetry={vi.fn()}
      />
    )

    expect(
      screen.getByRole('columnheader', { name: 'API key' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Consumption' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'API request count' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Tokens' })
    ).toBeInTheDocument()

    const production = screen.getByRole('row', { name: /production/ })
    expect(production).toHaveTextContent('3')
    expect(production).toHaveTextContent('12')
    expect(production).toHaveTextContent(/\$1/)

    const staging = screen.getByRole('row', { name: /staging/ })
    expect(staging).toHaveTextContent('1')
    expect(staging).toHaveTextContent('4')
  })

  test('shows an empty table when the selected range has no key usage', () => {
    renderTable(
      <PortalKeyUsageTable
        rows={[]}
        loading={false}
        error={false}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  test('hides the empty table while key usage is loading', () => {
    renderTable(
      <PortalKeyUsageTable rows={[]} loading error={false} onRetry={vi.fn()} />
    )

    expect(
      screen.getByRole('heading', { name: 'Usage by key' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText('No data')).toBeNull()
  })

  test('shows a retry action when key usage fails to load', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    renderTable(
      <PortalKeyUsageTable rows={[]} loading={false} error onRetry={onRetry} />
    )

    expect(screen.getByText('Failed to load key usage')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  test('shows a long key name in the usage row', () => {
    const name = 'production-backend-key-'.repeat(4)
    renderTable(
      <PortalKeyUsageTable
        rows={[{ tokenId: 8, name, quota: 500000, count: 2, tokens: 6 }]}
        loading={false}
        error={false}
        onRetry={vi.fn()}
      />
    )

    expect(
      screen.getByRole('row', { name: new RegExp(name) })
    ).toBeInTheDocument()
  })
})
