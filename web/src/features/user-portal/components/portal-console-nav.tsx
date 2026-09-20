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
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import {
  isUserPortalNavActive,
  USER_PORTAL_CONSOLE_NAV_ITEMS,
} from '@/features/user-portal/lib/nav'

export function PortalConsoleNav() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav
      aria-label={t('Console navigation')}
      className='portal-console-nav'
    >
      {USER_PORTAL_CONSOLE_NAV_ITEMS.map((item) => {
        const active = isUserPortalNavActive(pathname, item)
        const Icon = item.icon
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={cn(
              'portal-console-nav-link',
              active && 'portal-console-nav-active',
            )}
            key={item.href}
            to={item.href}
          >
            <Icon aria-hidden className='portal-console-nav-icon' strokeWidth={1.5} />
            <span>{t(item.titleKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
