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
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  FileText,
  KeyRound,
  LayoutGrid,
  Sparkles,
} from 'lucide-react'

export type UserPortalNavItem = {
  titleKey: string
  href: string
  icon: LucideIcon
}

export const USER_PORTAL_NAV_ITEMS: UserPortalNavItem[] = [
  {
    titleKey: 'Model Square',
    href: '/app',
    icon: LayoutGrid,
  },
  {
    titleKey: 'Experience Center',
    href: '/app/playground',
    icon: Sparkles,
  },
  {
    titleKey: 'API Keys',
    href: '/app/keys',
    icon: KeyRound,
  },
  {
    titleKey: 'Usage',
    href: '/app/usage',
    icon: BarChart3,
  },
  {
    titleKey: 'Request Logs',
    href: '/app/logs',
    icon: FileText,
  },
]
