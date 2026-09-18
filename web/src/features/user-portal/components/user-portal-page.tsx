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
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { PORTAL_PAGE_GUTTER, PORTAL_PAGE_WIDTH } from '../lib/layout'

type UserPortalPageProps = {
  title?: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  fixedHeight?: boolean
  centeredHero?: boolean
}

export function UserPortalPage(props: UserPortalPageProps) {
  const showHeader =
    props.title != null ||
    props.description != null ||
    props.actions != null ||
    props.eyebrow != null

  return (
    <div
      className={cn(
        'portal-enter flex min-h-0 flex-1 flex-col',
        props.fixedHeight && 'h-full overflow-hidden',
        props.className,
      )}
    >
      {showHeader ? (
        <div
          className={cn(
            'shrink-0 pt-6 pb-4 sm:pt-10',
            PORTAL_PAGE_GUTTER,
            props.centeredHero && 'portal-page-centered',
          )}
        >
          {props.centeredHero ? (
            <div>
              {props.eyebrow != null ? (
                <p className='portal-eyebrow'>{props.eyebrow}</p>
              ) : null}
              {props.title != null ? (
                <h1 className='portal-hero-title'>{props.title}</h1>
              ) : null}
              {props.description != null ? (
                <p className='portal-hero-subtitle'>{props.description}</p>
              ) : null}
            </div>
          ) : (
            <div
              className={cn(
                'mx-auto flex w-full flex-wrap items-start justify-between gap-4',
                PORTAL_PAGE_WIDTH,
              )}
            >
              <div className='min-w-0 max-w-3xl'>
                {props.eyebrow != null ? (
                  <p className='portal-eyebrow mb-3'>{props.eyebrow}</p>
                ) : null}
                {props.title != null ? (
                  <h1 className='portal-hero-title text-start text-2xl sm:text-[2rem]'>
                    {props.title}
                  </h1>
                ) : null}
                {props.description != null ? (
                  <p className='portal-hero-subtitle mx-0 mt-3 max-w-2xl text-start'>
                    {props.description}
                  </p>
                ) : null}
              </div>
              {props.actions != null ? (
                <div className='flex shrink-0 flex-wrap items-center gap-2'>
                  {props.actions}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      <div
        className={cn(
          'min-h-0 flex-1',
          PORTAL_PAGE_GUTTER,
          props.fixedHeight
            ? 'overflow-hidden pb-4 sm:pb-6'
            : 'overflow-auto pb-10 sm:pb-14',
        )}
      >
        <div
          className={cn(
            'mx-auto w-full',
            PORTAL_PAGE_WIDTH,
            props.fixedHeight && 'flex h-full min-h-0 flex-col',
            props.contentClassName,
          )}
        >
          {props.children}
        </div>
      </div>
    </div>
  )
}
