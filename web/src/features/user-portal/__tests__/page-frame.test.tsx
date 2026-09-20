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
import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { UserPortalPage } from '../components/user-portal-page'

describe('user portal page frame', () => {
  test('puts the title and body inside one white module on the gray canvas', () => {
    const { container } = render(
      <UserPortalPage title='Model Square'>
        <div data-testid='catalog-body' />
      </UserPortalPage>,
    )

    const module = container.querySelector('.portal-module')
    expect(module).not.toBeNull()
    expect(module?.className).toContain('max-w-(--portal-page-width)')
    expect(module).toHaveTextContent('Model Square')
    expect(module?.querySelector('[data-testid="catalog-body"]')).not.toBeNull()
  })

  test('skips the white page frame when the console layout already provides it', () => {
    const { container } = render(
      <UserPortalPage framed={false} title='Key Management'>
        <div data-testid='console-body' />
      </UserPortalPage>,
    )

    expect(container.querySelector('.portal-module')).toBeNull()
    expect(container).toHaveTextContent('Key Management')
    expect(
      container.querySelector('[data-testid="console-body"]'),
    ).not.toBeNull()
  })
})
