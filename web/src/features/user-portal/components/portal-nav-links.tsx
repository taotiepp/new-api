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
  USER_PORTAL_NAV_ITEMS,
  type UserPortalNavItem,
} from '@/features/user-portal/lib/nav'

type PortalNavLinkProps = {
  item: UserPortalNavItem
  layout: 'island' | 'mobile'
}

function isNavActive(pathname: string, href: string) {
  if (href === '/app') {
    return pathname === '/app' || pathname === '/app/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PortalNavLink(props: PortalNavLinkProps) {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = isNavActive(pathname, props.item.href)
  const Icon = props.item.icon

  if (props.layout === 'mobile') {
    return (
      <Link
        aria-current={active ? 'page' : undefined}
        className={cn(
          'portal-mobile-nav-item',
          active && 'portal-nav-item-active',
        )}
        to={props.item.href}
      >
        <Icon aria-hidden className='size-[1.125rem] shrink-0' />
        <span className='text-[10px] font-medium leading-tight'>
          {t(props.item.titleKey)}
        </span>
      </Link>
    )
  }

  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={cn('portal-island-nav-link', active && 'portal-island-nav-active')}
      to={props.item.href}
    >
      <Icon aria-hidden className='size-4 shrink-0 opacity-80' />
      <span>{t(props.item.titleKey)}</span>
    </Link>
  )
}

export function PortalNavLinks(props: { layout: 'island' | 'mobile' }) {
  return (
    <>
      {USER_PORTAL_NAV_ITEMS.map((item) => (
        <PortalNavLink key={item.href} item={item} layout={props.layout} />
      ))}
    </>
  )
}

export type { UserPortalNavItem }
