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
import { ChevronLeft, ChevronRight, Plus, RefreshCcw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import { SettingsSection } from '../components/settings-section'
import {
  createUserModelRateLimit,
  deleteUserModelRateLimit,
  listUserModelRateLimits,
  updateUserModelRateLimit,
  userModelOverrideQueryKeys,
  type UserModelRateLimitInput,
  type UserModelRateLimitRow,
} from './user-model-override-api'
import { UserModelOverrideDialog } from './user-model-override-dialog'
import {
  formatLimitCell,
  formatTokenMode,
} from './user-model-rate-limit-format'

const PAGE_SIZE = 20

export function UserModelOverrideSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [filterInput, setFilterInput] = useState('')
  const [filterUserId, setFilterUserId] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editRow, setEditRow] = useState<UserModelRateLimitRow | null>(null)
  const [deleteRow, setDeleteRow] = useState<UserModelRateLimitRow | null>(null)

  const listParams = { userId: filterUserId, page, pageSize: PAGE_SIZE }
  const listQuery = useQuery({
    queryKey: userModelOverrideQueryKeys.list(listParams),
    queryFn: async () =>
      requireServerSuccess(await listUserModelRateLimits(listParams)),
  })

  const rows = listQuery.data?.data?.items ?? []
  const total = listQuery.data?.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: userModelOverrideQueryKeys.lists(),
    })

  const saveMutation = useMutation({
    mutationFn: async (input: UserModelRateLimitInput) => {
      if (input.id && input.id > 0) {
        return requireServerSuccess(await updateUserModelRateLimit(input))
      }
      return requireServerSuccess(await createUserModelRateLimit(input))
    },
    onSuccess: () => {
      toast.success(t('Saved successfully'))
      invalidate()
      setDialogOpen(false)
      setEditRow(null)
    },
    onError: (error: Error) => {
      handleServerError(error, t('Failed to save limit'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) =>
      requireServerSuccess(await deleteUserModelRateLimit(id)),
    onSuccess: () => {
      toast.success(t('Deleted successfully'))
      invalidate()
      setDeleteRow(null)
    },
    onError: (error: Error) => {
      handleServerError(error, t('Failed to delete limit'))
    },
  })

  const applyFilter = () => {
    const parsed = Number.parseInt(filterInput, 10)
    setFilterUserId(Number.isFinite(parsed) && parsed > 0 ? parsed : 0)
    setPage(1)
  }

  return (
    <SettingsSection title={t('Per-user Overrides')}>
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex items-center gap-2'>
            <Input
              type='number'
              min={0}
              className='w-40'
              placeholder={t('Filter by user ID')}
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilter()
              }}
            />
            <Button type='button' variant='outline' size='sm' onClick={applyFilter}>
              {t('Filter')}
            </Button>
          </div>
          <div className='ml-auto flex items-center gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              <RefreshCcw className='mr-2 h-4 w-4' />
              {t('Refresh')}
            </Button>
            <Button
              type='button'
              size='sm'
              onClick={() => {
                setEditRow(null)
                setDialogOpen(true)
              }}
            >
              <Plus className='mr-2 h-4 w-4' />
              {t('Add override')}
            </Button>
          </div>
        </div>

        <StaticDataTable
          data={rows}
          getRowKey={(row) => row.id}
          emptyContent={t('No per-user overrides configured.')}
          columns={[
            {
              id: 'user',
              header: t('User ID'),
              cell: (row) => <span className='font-mono'>#{row.user_id}</span>,
            },
            {
              id: 'model',
              header: t('Model Name'),
              cellClassName: 'font-medium',
              cell: (row) =>
                row.model_name === '' ? (
                  <span className='text-muted-foreground'>{t('All models')}</span>
                ) : (
                  row.model_name
                ),
            },
            {
              id: 'rpm',
              header: t('RPM'),
              className: 'text-right',
              cellClassName: 'text-right',
              cell: (row) => formatLimitCell(row.rpm, t),
            },
            {
              id: 'tpm',
              header: t('TPM'),
              className: 'text-right',
              cellClassName: 'text-right',
              cell: (row) => formatLimitCell(row.tpm, t),
            },
            {
              id: 'mode',
              header: t('Token Mode'),
              cell: (row) => formatTokenMode(row.token_mode, t),
            },
            {
              id: 'enabled',
              header: t('Status'),
              cell: (row) => (
                <Badge variant={row.enabled ? 'default' : 'secondary'}>
                  {row.enabled ? t('Enabled') : t('Disabled')}
                </Badge>
              ),
            },
            {
              id: 'actions',
              header: t('Actions'),
              className: 'text-right',
              cellClassName: 'text-right',
              cell: (row) => (
                <StaticRowActions
                  editLabel={t('Edit')}
                  deleteLabel={t('Delete')}
                  menuLabel={t('Open menu')}
                  onEdit={() => {
                    setEditRow(row)
                    setDialogOpen(true)
                  }}
                  onDelete={() => setDeleteRow(row)}
                />
              ),
            },
          ]}
        />

        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground text-sm'>
            {t('Total')}: {total}
          </span>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='icon'
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label={t('Previous page')}
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <span className='text-sm'>
              {page} / {totalPages}
            </span>
            <Button
              type='button'
              variant='outline'
              size='icon'
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label={t('Next page')}
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>

      <UserModelOverrideDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditRow(null)
        }}
        editRow={editRow}
        isSubmitting={saveMutation.isPending}
        onSubmit={async (input) => {
          await saveMutation.mutateAsync(input)
        }}
      />

      <ConfirmDialog
        open={!!deleteRow}
        onOpenChange={(open) => {
          if (!open) setDeleteRow(null)
        }}
        title={t('Delete override')}
        desc={t('Are you sure you want to delete this override?')}
        destructive
        confirmText={deleteMutation.isPending ? t('Deleting...') : t('Delete')}
        isLoading={deleteMutation.isPending}
        handleConfirm={() => {
          if (deleteRow) deleteMutation.mutate(deleteRow.id)
        }}
      />
    </SettingsSection>
  )
}
