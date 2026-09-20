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
import { describe, expect, test } from 'vitest'

import { PORTAL_PAGE_GUTTER, PORTAL_PAGE_WIDTH } from '../lib/layout'

describe('user portal page column', () => {
  test('locks tab content to the same full-bleed width token as the portal island', () => {
    expect(PORTAL_PAGE_WIDTH).toBe('max-w-(--portal-page-width)')
  })

  test('locks tab gutters to the same inline padding token as the portal chrome', () => {
    expect(PORTAL_PAGE_GUTTER).toBe('px-(--portal-page-gutter)')
  })
})
