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
import { Outlet, useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import '@/styles/portal.css'

import { isUserPortalConsolePath } from '../lib/nav'
import { PortalConsoleNav } from './portal-console-nav'
import { PortalNavLinks } from './portal-nav-links'
import { UserPortalHeader } from './user-portal-header'

export function UserPortalLayout() {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const consolePath = isUserPortalConsolePath(pathname)

  return (
    <div
      className={cn('portal-shell min-h-dvh')}
      data-portal-console={consolePath ? '' : undefined}
      data-user-portal
    >
      <div aria-hidden className='portal-mesh-bg' />
      <div className='portal-main'>
        <UserPortalHeader />
        <main className='portal-content' id='user-portal-main'>
          {consolePath ? (
            <div className='portal-console-body'>
              <PortalConsoleNav />
              <div className='portal-console-stage'>
                <div className='portal-module portal-console-main'>
                  <Outlet />
                </div>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <nav
        aria-label={t('User Portal navigation')}
        className='portal-mobile-nav lg:hidden'
      >
        <PortalNavLinks layout='mobile' />
      </nav>
    </div>
  )
}
