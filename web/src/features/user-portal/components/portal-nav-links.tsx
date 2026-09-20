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

import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import {
  isUserPortalNavActive,
  resolveUserPortalDocsHref,
  USER_PORTAL_TOP_NAV_ITEMS,
  type UserPortalNavItem,
} from '@/features/user-portal/lib/nav'

type PortalNavLinkProps = {
  item: UserPortalNavItem
  layout: 'island' | 'mobile'
  href: string
  external?: boolean
}

export function PortalNavLink(props: PortalNavLinkProps) {
  const { t } = useTranslation()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = isUserPortalNavActive(pathname, props.item)
  const Icon = props.item.icon
  const className =
    props.layout === 'mobile'
      ? cn('portal-mobile-nav-item', active && 'portal-nav-item-active')
      : cn('portal-island-nav-link', active && 'portal-island-nav-active')

  const label = (
    <>
      <Icon
        aria-hidden
        className={
          props.layout === 'mobile'
            ? 'size-[1.125rem] shrink-0'
            : 'size-4 shrink-0 opacity-80'
        }
      />
      {props.layout === 'mobile' ? (
        <span className='text-[10px] font-medium leading-tight'>
          {t(props.item.titleKey)}
        </span>
      ) : (
        <span>{t(props.item.titleKey)}</span>
      )}
    </>
  )

  if (props.external) {
    return (
      <a
        aria-current={active ? 'page' : undefined}
        className={className}
        href={props.href}
        rel='noopener noreferrer'
        target='_blank'
      >
        {label}
      </a>
    )
  }

  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={className}
      to={props.href}
    >
      {label}
    </Link>
  )
}

export function PortalNavLinks(props: { layout: 'island' | 'mobile' }) {
  const { status } = useStatus()
  const docs = resolveUserPortalDocsHref(
    status?.docs_link as string | undefined,
  )

  return (
    <>
      {USER_PORTAL_TOP_NAV_ITEMS.map((item) => {
        if (item.match === 'docs') {
          return (
            <PortalNavLink
              key={item.titleKey}
              item={item}
              layout={props.layout}
              href={docs.href}
              external={docs.external}
            />
          )
        }
        return (
          <PortalNavLink
            key={item.titleKey}
            item={item}
            layout={props.layout}
            href={item.href}
          />
        )
      })}
    </>
  )
}

export type { UserPortalNavItem }
