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
import type { ReactNode } from 'react'
import { describe, expect, test, vi } from 'vitest'

import { AccountCostTable } from '../components/account-cost-table'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: {
    to: string
    search?: Record<string, string | number>
    children: ReactNode
  }) => (
    <a
      href={`${props.to}?${new URLSearchParams(
        Object.entries(props.search ?? {}).map(([key, value]) => [
          key,
          String(value),
        ])
      ).toString()}`}
    >
      {props.children}
    </a>
  ),
}))

describe('account cost table', () => {
  test('links an account to that user usage range', () => {
    render(
      <AccountCostTable
        accounts={[
          {
            user_id: 2,
            username: 'bob',
            display_name: 'Bob',
            quota: 500000,
            count: 3,
            token_used: 14,
          },
        ]}
        start={new Date('2026-10-01T00:00:00')}
        end={new Date('2026-10-31T23:59:59')}
      />
    )

    const link = screen.getByRole('link', { name: 'bob' })
    const href = link.getAttribute('href') ?? ''
    expect(href).toContain('/app/usage?')
    expect(href).toContain('userId=2')
    expect(href).toContain('username=bob')
    expect(href).toContain('startTime=')
    expect(href).toContain('endTime=')
    expect(screen.getByText('Monthly cost')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
  })
})
