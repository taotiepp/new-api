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
import { useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { UserPortalPage } from '@/features/user-portal/components/user-portal-page'

import { getDocTree } from '../api'
import { docPathFromLocation } from '../lib/tree'
import { DocsNav } from './docs-nav'

export function DocsFrame(props: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const activePath = docPathFromLocation(pathname)
  const treeQuery = useQuery({
    queryKey: ['doc-site', 'tree'],
    queryFn: getDocTree,
  })
  const nodes = treeQuery.data?.data ?? []

  let menu: ReactNode
  if (treeQuery.isPending) {
    menu = <LoadingState size='sm' />
  } else if (treeQuery.isError) {
    menu = (
      <ErrorState
        description={t('Failed to load documentation')}
        onRetry={() => void treeQuery.refetch()}
      />
    )
  } else {
    menu = (
      <DocsNav
        activePath={activePath}
        nodes={nodes}
        onNavigate={() => setMenuOpen(false)}
      />
    )
  }

  return (
    <UserPortalPage title={t('Docs')}>
      <div className='flex min-h-0 flex-col gap-4 lg:flex-row lg:gap-6'>
        <aside className='hidden w-56 shrink-0 lg:block'>
          <ScrollArea className='max-h-[calc(100dvh-14rem)]'>{menu}</ScrollArea>
        </aside>
        <div className='min-w-0 flex-1 border-t border-[var(--portal-hairline)] pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6'>
          <div className='mb-4 lg:hidden'>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger render={<Button variant='outline' size='sm' />}>
                <Menu aria-hidden />
                {t('Contents')}
              </SheetTrigger>
              <SheetContent
                data-user-portal
                side='left'
                className='w-72 p-0'
              >
                <SheetHeader className='border-b'>
                  <SheetTitle>{t('Documentation')}</SheetTitle>
                </SheetHeader>
                <ScrollArea className='h-[calc(100svh-4rem)]'>{menu}</ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
          {props.children}
        </div>
      </div>
    </UserPortalPage>
  )
}
