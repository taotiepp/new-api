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

import { PortalConsoleNav } from '../components/portal-console-nav'
import { UserPortalLayout } from '../components/user-portal-layout'

const routerState = vi.hoisted(() => ({ pathname: '/app/keys' }))

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    to: string
    children: React.ReactNode
    className?: string
    'aria-current'?: 'page'
  }) => (
    <a
      aria-current={props['aria-current']}
      className={props.className}
      href={props.to}
    >
      {props.children}
    </a>
  ),
  Outlet: () => <div data-testid='console-outlet' />,
  useRouterState: (opts: {
    select: (state: { location: { pathname: string } }) => string
  }) => opts.select({ location: { pathname: routerState.pathname } }),
}))

vi.mock('../components/user-portal-header', () => ({
  UserPortalHeader: () => <div className='portal-top-chrome' />,
}))

vi.mock('../components/portal-nav-links', () => ({
  PortalNavLinks: () => null,
}))

afterEach(() => {
  routerState.pathname = '/app/keys'
  vi.clearAllMocks()
})

describe('portal console navigation', () => {
  test('renders sidebar links and marks the current console page', () => {
    render(<PortalConsoleNav />)

    const keys = screen.getByRole('link', { name: 'Key Management' })
    expect(keys).toHaveAttribute('href', '/app/keys')
    expect(keys).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Usage Statistics' })).toHaveAttribute(
      'href',
      '/app/usage',
    )
    expect(screen.getByRole('link', { name: 'System Settings' })).toHaveAttribute(
      'href',
      '/app/settings',
    )
    expect(screen.getByRole('navigation', { name: 'Console navigation' })).toHaveClass(
      'portal-console-nav',
    )
  })

  test('sits on the chrome canvas beside the white stage, not inside it', () => {
    const { container } = render(<UserPortalLayout />)
    const nav = container.querySelector('.portal-console-nav')
    const stage = container.querySelector('.portal-console-stage')
    const module = container.querySelector('.portal-console-main')

    expect(container.querySelector('[data-portal-console]')).not.toBeNull()
    expect(nav).not.toBeNull()
    expect(nav?.closest('.portal-module')).toBeNull()
    expect(stage?.contains(nav)).toBe(false)
    expect(module).toHaveClass('portal-module')
    expect(module).toContainElement(screen.getByTestId('console-outlet'))
  })
})
