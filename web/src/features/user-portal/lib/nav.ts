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
  Building2,
  ClipboardList,
  FileText,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Receipt,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export type UserPortalNavMatch = 'console' | 'plaza' | 'prefix'

export type UserPortalNavItem = {
  titleKey: string
  href: string
  icon: LucideIcon
  match: UserPortalNavMatch
  adminOnly?: boolean
}

export const USER_PORTAL_CONSOLE_HREF = '/app/keys'

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
    href: '/app/docs',
    icon: BookOpen,
    match: 'prefix',
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
    titleKey: 'Virtual groups',
    href: '/app/virtual-groups',
    icon: Layers,
    match: 'prefix',
  },
  {
    titleKey: 'Suppliers',
    href: '/app/suppliers',
    icon: Building2,
    match: 'prefix',
    adminOnly: true,
  },
  {
    titleKey: 'Operations management',
    href: '/app/operations',
    icon: ClipboardList,
    match: 'prefix',
    adminOnly: true,
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
    titleKey: 'Bill Management',
    href: '/app/bills',
    icon: Receipt,
    match: 'prefix',
  },
  {
    titleKey: 'System Settings',
    href: '/app/settings',
    icon: Settings,
    match: 'prefix',
  },
]

const USER_PORTAL_CONSOLE_PAGE_PREFIXES = ['/app/security']

export function isUserPortalConsolePath(pathname: string): boolean {
  if (
    USER_PORTAL_CONSOLE_PAGE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true
  }
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
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
