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
import type { Table } from '@tanstack/react-table'
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ChevronsLeft as DoubleArrowLeftIcon,
  ChevronsRight as DoubleArrowRightIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn, getPageNumbers } from '@/lib/utils'

type ControlledPagination = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

type DataTablePaginationProps<TData> = {
  compact?: boolean
} & (
  | { table: Table<TData>; pagination?: never }
  | { table?: never; pagination: ControlledPagination }
)

type PaginationControls = {
  currentPage: number
  pageSize: number
  totalPages: number
  totalRows: number
  canPrevious: boolean
  canNext: boolean
  goToFirst: () => void
  goToPrevious: () => void
  goToNext: () => void
  goToLast: () => void
  goToPage: (page: number) => void
  setPageSize: (pageSize: number) => void
}

function tablePaginationControls<TData>(table: Table<TData>): PaginationControls {
  const pagination = table.getState().pagination
  return {
    currentPage: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    totalPages: table.getPageCount(),
    totalRows: table.getRowCount(),
    canPrevious: table.getCanPreviousPage(),
    canNext: table.getCanNextPage(),
    goToFirst: () => table.setPageIndex(0),
    goToPrevious: () => table.previousPage(),
    goToNext: () => table.nextPage(),
    goToLast: () => table.setPageIndex(table.getPageCount() - 1),
    goToPage: (page) => table.setPageIndex(page - 1),
    setPageSize: (pageSize) => table.setPageSize(pageSize),
  }
}

function controlledPaginationControls(
  pagination: ControlledPagination
): PaginationControls {
  const totalPages = Math.max(
    1,
    Math.ceil(pagination.total / pagination.pageSize)
  )
  return {
    currentPage: pagination.page,
    pageSize: pagination.pageSize,
    totalPages,
    totalRows: pagination.total,
    canPrevious: pagination.page > 1,
    canNext: pagination.page < totalPages,
    goToFirst: () => pagination.onPageChange(1),
    goToPrevious: () =>
      pagination.onPageChange(Math.max(1, pagination.page - 1)),
    goToNext: () =>
      pagination.onPageChange(Math.min(totalPages, pagination.page + 1)),
    goToLast: () => pagination.onPageChange(totalPages),
    goToPage: (page) => pagination.onPageChange(page),
    setPageSize: (pageSize) => pagination.onPageSizeChange(pageSize),
  }
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50, 100] as const
const PAGE_SIZE_SELECT_ITEMS = PAGE_SIZE_OPTIONS.map((pageSize) => ({
  value: `${pageSize}`,
  label: pageSize,
}))

export function DataTablePagination<TData>(
  props: DataTablePaginationProps<TData>
) {
  const { t } = useTranslation()
  const compact = props.compact ?? false
  const controls = props.table
    ? tablePaginationControls(props.table)
    : controlledPaginationControls(props.pagination)
  const currentPage = controls.currentPage
  const pageSize = controls.pageSize
  const totalPages = controls.totalPages
  const totalRows = controls.totalRows
  const pageNumbers = getPageNumbers(currentPage, totalPages)
  const pageItems = pageNumbers.map((page, index) => ({
    page,
    key: page === '...' ? `gap-after-${pageNumbers[index - 1]}` : String(page),
  }))

  if (compact) {
    return (
      <nav
        aria-label={t('Page')}
        className='flex w-full min-w-0 flex-wrap items-center justify-between gap-2 text-sm'
      >
        <span className='text-muted-foreground min-w-0 [overflow-wrap:anywhere]'>
          {t('Total:')} {totalRows.toLocaleString()}
        </span>
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='icon'
            className='size-11'
            aria-label={t('Go to previous page')}
            onClick={() => controls.goToPrevious()}
            disabled={!controls.canPrevious}
          >
            <ChevronLeftIcon />
          </Button>
          <span className='tabular-nums' aria-live='polite'>
            {currentPage} / {Math.max(1, totalPages)}
          </span>
          <Button
            variant='outline'
            size='icon'
            className='size-11'
            aria-label={t('Go to next page')}
            onClick={() => controls.goToNext()}
            disabled={!controls.canNext}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </nav>
    )
  }

  return (
    <div
      className={cn(
        '@container/pagination flex min-w-0 items-center justify-end overflow-clip'
      )}
      style={{ overflowClipMargin: 1 }}
    >
      <div className='flex min-w-0 shrink-0 items-center gap-2 @xl/pagination:gap-3'>
        <div className='flex shrink-0 items-baseline gap-1.5 text-xs font-medium whitespace-nowrap sm:text-sm'>
          <span className='text-muted-foreground/80'>{t('Total:')}</span>
          <span className='text-foreground tabular-nums'>
            {totalRows.toLocaleString()}
          </span>
        </div>

        <div className='flex shrink-0 items-center gap-1.5 @lg/pagination:gap-2'>
          <p className='text-muted-foreground/80 hidden text-sm font-medium whitespace-nowrap @2xl/pagination:block'>
            {t('Rows per page')}
          </p>
          <Select
            items={PAGE_SIZE_SELECT_ITEMS}
            value={`${pageSize}`}
            onValueChange={(value) => {
              controls.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className='text-foreground h-8 w-[64px] font-medium tabular-nums sm:w-[70px]'>
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side='top' alignItemWithTrigger={false}>
              <SelectGroup>
                {PAGE_SIZE_OPTIONS.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className='flex min-w-0 shrink-0 items-center gap-1 @lg/pagination:gap-1.5 @xl/pagination:gap-2'>
          <Button
            variant='outline'
            className='text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 size-8 p-0 @max-lg/pagination:hidden'
            onClick={() => controls.goToFirst()}
            disabled={!controls.canPrevious}
          >
            <span className='sr-only'>{t('Go to first page')}</span>
            <DoubleArrowLeftIcon className='h-4 w-4' />
          </Button>
          <Button
            variant='outline'
            className='text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 size-8 p-0'
            onClick={() => controls.goToPrevious()}
            disabled={!controls.canPrevious}
          >
            <span className='sr-only'>{t('Go to previous page')}</span>
            <ChevronLeftIcon className='h-4 w-4' />
          </Button>

          {pageItems.map(({ page: pageNumber, key }) => (
            <div key={key} className='flex items-center'>
              {typeof pageNumber === 'number' ? (
                <Button
                  variant={currentPage === pageNumber ? 'default' : 'outline'}
                  className={cn(
                    'h-8 min-w-8 px-2 tabular-nums',
                    currentPage === pageNumber
                      ? 'font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => controls.goToPage(pageNumber)}
                >
                  <span className='sr-only'>
                    {t('Go to page {{page}}', { page: pageNumber })}
                  </span>
                  {pageNumber}
                </Button>
              ) : (
                <span className='text-muted-foreground/60 px-0.5 text-sm @lg/pagination:px-1'>
                  ...
                </span>
              )}
            </div>
          ))}

          <Button
            variant='outline'
            className='text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 size-8 p-0'
            onClick={() => controls.goToNext()}
            disabled={!controls.canNext}
          >
            <span className='sr-only'>{t('Go to next page')}</span>
            <ChevronRightIcon className='h-4 w-4' />
          </Button>
          <Button
            variant='outline'
            className='text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 size-8 p-0 @max-lg/pagination:hidden'
            onClick={() => controls.goToLast()}
            disabled={!controls.canNext}
          >
            <span className='sr-only'>{t('Go to last page')}</span>
            <DoubleArrowRightIcon className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </div>
  )
}
