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
  framed?: boolean
}

export function UserPortalPage(props: UserPortalPageProps) {
  const showHeader =
    props.title != null ||
    props.description != null ||
    props.actions != null ||
    props.eyebrow != null
  const framed = props.framed !== false
  const shellOverflow = props.fixedHeight ? 'overflow-hidden' : 'overflow-auto'
  const shellPad = framed
    ? 'py-4 sm:py-6 lg:py-7'
    : 'px-4 py-4 sm:px-6 sm:py-5'

  return (
    <div
      className={cn(
        'portal-enter flex min-h-0 flex-1 flex-col',
        props.fixedHeight && 'h-full overflow-hidden',
        props.className,
      )}
    >
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          framed && PORTAL_PAGE_GUTTER,
          shellOverflow,
          shellPad,
        )}
      >
        <div
          className={cn(
            'mx-auto flex w-full min-h-0 flex-1 flex-col',
            framed && 'portal-module',
            framed && PORTAL_PAGE_WIDTH,
            props.fixedHeight && 'overflow-hidden',
            props.contentClassName,
          )}
        >
          {showHeader ? (
            <div
              className={cn(
                'shrink-0 pb-5',
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
                <div className='flex w-full flex-wrap items-start justify-between gap-4'>
                  <div className='min-w-0 max-w-3xl'>
                    {props.eyebrow != null ? (
                      <p className='portal-eyebrow mb-3'>{props.eyebrow}</p>
                    ) : null}
                    {props.title != null ? (
                      <h1 className='portal-hero-title mt-0 text-start text-2xl sm:text-[2rem]'>
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
              props.fixedHeight ? 'overflow-hidden' : 'overflow-visible',
            )}
          >
            {props.children}
          </div>
        </div>
      </div>
    </div>
  )
}
