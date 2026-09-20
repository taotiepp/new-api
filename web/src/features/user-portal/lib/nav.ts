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
import {
  BarChart3,
  BookOpen,
  FileText,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export type UserPortalNavMatch = 'console' | 'plaza' | 'prefix' | 'docs'

export type UserPortalNavItem = {
  titleKey: string
  href: string
  icon: LucideIcon
  match: UserPortalNavMatch
}

export const USER_PORTAL_CONSOLE_HREF = '/app/keys'
export const DEFAULT_USER_PORTAL_DOCS_HREF = 'https://docs.newapi.pro'

export const USER_PORTAL_TOP_NAV_ITEMS: UserPortalNavItem[] = [
  {
    titleKey: 'Console',
    href: USER_PORTAL_CONSOLE_HREF,
    icon: LayoutDashboard,
    match: 'console',
  },
  {
    titleKey: 'Model Square',
    href: '/app',
    icon: LayoutGrid,
    match: 'plaza',
  },
  {
    titleKey: 'Experience Center',
    href: '/app/playground',
    icon: Sparkles,
    match: 'prefix',
  },
  {
    titleKey: 'Docs',
    href: 'docs',
    icon: BookOpen,
    match: 'docs',
  },
]

export const USER_PORTAL_CONSOLE_NAV_ITEMS: UserPortalNavItem[] = [
  {
    titleKey: 'Key Management',
    href: '/app/keys',
    icon: KeyRound,
    match: 'prefix',
  },
  {
    titleKey: 'Usage Statistics',
    href: '/app/usage',
    icon: BarChart3,
    match: 'prefix',
  },
  {
    titleKey: 'Request Logs',
    href: '/app/logs',
    icon: FileText,
    match: 'prefix',
  },
  {
    titleKey: 'System Settings',
    href: '/app/settings',
    icon: Settings,
    match: 'prefix',
  },
]

export function isUserPortalConsolePath(pathname: string): boolean {
  return USER_PORTAL_CONSOLE_NAV_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )
}

export function isUserPortalPlazaPath(pathname: string): boolean {
  return (
    pathname === '/app' ||
    pathname === '/app/' ||
    pathname.startsWith('/app/models')
  )
}

export function resolveUserPortalDocsHref(docsLink: string | undefined): {
  href: string
  external: boolean
} {
  const href = docsLink?.trim() || DEFAULT_USER_PORTAL_DOCS_HREF
  return {
    href,
    external: href.startsWith('http://') || href.startsWith('https://'),
  }
}

export function isUserPortalNavActive(
  pathname: string,
  item: UserPortalNavItem,
): boolean {
  if (item.match === 'console') {
    return isUserPortalConsolePath(pathname)
  }
  if (item.match === 'plaza') {
    return isUserPortalPlazaPath(pathname)
  }
  if (item.match === 'docs') {
    return false
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
