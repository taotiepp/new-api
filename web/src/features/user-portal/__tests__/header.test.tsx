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
import { afterEach, describe, expect, test, vi } from 'vitest'

import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { UserPortalHeader } from '../components/user-portal-header'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children?: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: { system_name: 'New API' } }),
}))

vi.mock('@/hooks/use-system-config', () => ({
  useSystemConfig: () => ({ logo: '/logo.png' }),
}))

vi.mock('../components/portal-nav-links', () => ({
  PortalNavLinks: () => null,
}))

vi.mock('../components/user-portal-quota-summary', () => ({
  UserPortalQuotaSummary: () => null,
}))

vi.mock('@/components/profile-dropdown', () => ({
  ProfileDropdown: () => null,
}))

vi.mock('@/components/pricing-currency-switch', () => ({
  PricingCurrencySwitch: () => null,
}))

vi.mock('@/components/theme-switch', () => ({
  ThemeSwitch: () => null,
}))

function signIn(role: number) {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'alice',
    role,
  })
}

afterEach(() => {
  useAuthStore.getState().auth.reset()
})

describe('user portal header', () => {
  test('lets an administrator open the legacy console', () => {
    signIn(ROLE.ADMIN)
    render(<UserPortalHeader />)

    expect(screen.getByRole('link', { name: 'Legacy console' })).toHaveAttribute(
      'href',
      '/channels'
    )
  })

  test('hides the legacy console from ordinary users', () => {
    signIn(ROLE.USER)
    render(<UserPortalHeader />)

    expect(screen.queryByRole('link', { name: 'Legacy console' })).toBeNull()
  })
})
