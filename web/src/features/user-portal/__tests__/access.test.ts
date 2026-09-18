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

import { ROLE } from '@/lib/roles'

import {
  isConsoleAuthenticatedPath,
  isUserPortalPath,
  mapConsolePathToUserPortal,
  resolveDefaultAuthenticatedPath,
  resolvePostLoginTarget,
  resolveUserPortalRedirectForPath,
} from '../lib/access'

const origin = 'https://app.example.com'

describe('user portal access', () => {
  test('default authenticated landing by role', () => {
    expect(resolveDefaultAuthenticatedPath(ROLE.USER)).toBe('/app')
    expect(resolveDefaultAuthenticatedPath(ROLE.ADMIN)).toBe('/dashboard')
  })

  test('post-login redirect respects role and console mapping', () => {
    expect(
      resolvePostLoginTarget('/dashboard', ROLE.USER, origin)
    ).toBe('/app/usage')
    expect(
      resolvePostLoginTarget('/channels', ROLE.USER, origin)
    ).toBe('/app')
    expect(
      resolvePostLoginTarget('/dashboard', ROLE.ADMIN, origin)
    ).toBe('/dashboard')
    expect(resolvePostLoginTarget(undefined, ROLE.USER, origin)).toBe('/app')
  })

  test('portal path detection', () => {
    expect(isUserPortalPath('/app')).toBe(true)
    expect(isUserPortalPath('/app/keys')).toBe(true)
    expect(isUserPortalPath('/dashboard')).toBe(false)
  })

  test('console path mapping for regular users', () => {
    expect(mapConsolePathToUserPortal('/keys')).toBe('/app/keys')
    expect(mapConsolePathToUserPortal('/usage-logs/common')).toBe('/app/logs')
    expect(mapConsolePathToUserPortal('/channels')).toBe('/app')
  })

  test('authenticated guard redirect for non-admin', () => {
    expect(
      resolveUserPortalRedirectForPath(ROLE.USER, '/dashboard/overview')
    ).toBe('/app/usage')
    expect(resolveUserPortalRedirectForPath(ROLE.USER, '/app')).toBe(null)
    expect(resolveUserPortalRedirectForPath(ROLE.USER, '/profile')).toBe(null)
    expect(
      resolveUserPortalRedirectForPath(ROLE.ADMIN, '/channels')
    ).toBe(null)
  })

  test('console path classification', () => {
    expect(isConsoleAuthenticatedPath('/keys')).toBe(true)
    expect(isConsoleAuthenticatedPath('/profile')).toBe(false)
  })
})
