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

import {
  DEFAULT_USER_PORTAL_DOCS_HREF,
  isUserPortalConsolePath,
  isUserPortalNavActive,
  isUserPortalPlazaPath,
  resolveUserPortalDocsHref,
  USER_PORTAL_CONSOLE_NAV_ITEMS,
  USER_PORTAL_TOP_NAV_ITEMS,
} from '../lib/nav'

describe('user portal navigation', () => {
  test('keeps four global top links for console, plaza, playground, and docs', () => {
    expect(USER_PORTAL_TOP_NAV_ITEMS.map((item) => item.titleKey)).toEqual([
      'Console',
      'Model Square',
      'Experience Center',
      'Docs',
    ])
  })

  test('puts key, usage, logs, bills, and settings items in the console sidebar', () => {
    expect(USER_PORTAL_CONSOLE_NAV_ITEMS.map((item) => item.href)).toEqual([
      '/app/keys',
      '/app/usage',
      '/app/logs',
      '/app/bills',
      '/app/settings',
    ])
  })

  test('treats console feature routes as console paths and plaza routes as plaza', () => {
    expect(isUserPortalConsolePath('/app/keys')).toBe(true)
    expect(isUserPortalConsolePath('/app/bills')).toBe(true)
    expect(isUserPortalConsolePath('/app/settings')).toBe(true)
    expect(isUserPortalConsolePath('/app')).toBe(false)
    expect(isUserPortalConsolePath('/app/playground')).toBe(false)
    expect(isUserPortalPlazaPath('/app')).toBe(true)
    expect(isUserPortalPlazaPath('/app/models/gpt')).toBe(true)
    expect(isUserPortalPlazaPath('/app/keys')).toBe(false)
  })

  test('marks the Console top link active on any console sidebar route', () => {
    const consoleItem = USER_PORTAL_TOP_NAV_ITEMS[0]
    const plazaItem = USER_PORTAL_TOP_NAV_ITEMS[1]
    expect(isUserPortalNavActive('/app/usage', consoleItem)).toBe(true)
    expect(isUserPortalNavActive('/app/usage', plazaItem)).toBe(false)
    expect(isUserPortalNavActive('/app', plazaItem)).toBe(true)
    expect(isUserPortalNavActive('/app', consoleItem)).toBe(false)
  })

  test('uses the configured docs link when present and falls back to the public docs', () => {
    expect(resolveUserPortalDocsHref('https://example.com/help')).toEqual({
      href: 'https://example.com/help',
      external: true,
    })
    expect(resolveUserPortalDocsHref('/docs')).toEqual({
      href: '/docs',
      external: false,
    })
    expect(resolveUserPortalDocsHref(undefined)).toEqual({
      href: DEFAULT_USER_PORTAL_DOCS_HREF,
      external: true,
    })
  })
})
