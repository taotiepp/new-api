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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { handleServerError } from '@/lib/handle-server-error'

import { getChannelSuppliers, updateChannelSupplier } from './api'
import { SupplierEditDialog } from './components/supplier-edit-dialog'
import { SupplierTable } from './components/supplier-table'
import type { Supplier, SupplierProfileInput } from './types'

export function SuppliersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const appliedQuery = useRef('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = keyword.trim()
      if (next === appliedQuery.current) return
      appliedQuery.current = next
      setQuery(next)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [keyword])

  const suppliers = useQuery({
    queryKey: ['channel-suppliers', query, page],
    queryFn: () => getChannelSuppliers({ keyword: query, page }),
  })
  const save = useMutation({
    mutationFn: (input: {
      supplier: Supplier
      body: { discount: number | null; profile: SupplierProfileInput }
    }) => updateChannelSupplier(input.supplier.id, input.body),
    onSuccess: async () => {
      toast.success(t('Supplier saved'))
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: ['channel-suppliers'] })
    },
    onError: (error: Error) => {
      handleServerError(error)
    },
  })

  const items = suppliers.data?.items ?? []
  const total = suppliers.data?.total ?? 0
  const pageSize = suppliers.data?.page_size ?? 20
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-4'>
      <Input
        aria-label={t('Search channels')}
        placeholder={t('Search channels')}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />
      {suppliers.isLoading ? <LoadingState /> : null}
      {suppliers.isError ? (
        <ErrorState
          description={suppliers.error.message}
          title={t('Could not load suppliers')}
          onRetry={() => void suppliers.refetch()}
        />
      ) : null}
      {suppliers.isSuccess && items.length === 0 ? (
        <EmptyState
          description={t(
            'Channels you add in the legacy console show up here.'
          )}
          title={t('No suppliers yet')}
        />
      ) : null}
      {suppliers.isSuccess && items.length > 0 ? (
        <SupplierTable suppliers={items} onEdit={setEditing} />
      ) : null}
      {total > pageSize ? (
        <div className='flex items-center justify-end gap-2'>
          <Button
            disabled={page <= 1}
            type='button'
            variant='outline'
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t('Previous')}
          </Button>
          <Button
            disabled={page >= pageCount}
            type='button'
            variant='outline'
            onClick={() => setPage((current) => current + 1)}
          >
            {t('Next')}
          </Button>
        </div>
      ) : null}
      <SupplierEditDialog
        saving={save.isPending}
        supplier={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSave={(supplier, body) => save.mutate({ supplier, body })}
      />
    </div>
  )
}
