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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Loader2, Plus } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ActivityTimeCell } from '@/components/activity-time-cell'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  deleteApiKey,
  fetchTokenKey,
  getApiKeys,
  searchApiKeys,
  updateApiKeyStatus,
} from '@/features/keys/api'
import {
  API_KEY_STATUS,
  API_KEY_STATUSES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
} from '@/features/keys/constants'
import type { ApiKey } from '@/features/keys/types'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { usePricingCurrency } from '@/lib/currency'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import { PortalKeysCreateDialog } from './portal-keys-create-dialog'

const PAGE_SIZE = 20

export function PortalKeysPanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { formatQuota } = usePricingCurrency()
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ApiKey | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = keywordInput.trim()
      setKeyword(next)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [keywordInput])

  const listQuery = useQuery({
    queryKey: ['user-portal', 'keys', keyword, page],
    queryFn: async () => {
      const result = keyword
        ? await searchApiKeys({ keyword, p: page, size: PAGE_SIZE })
        : await getApiKeys({ p: page, size: PAGE_SIZE })
      return requireServerSuccess(result).data
    },
  })

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const refreshKeys = () =>
    queryClient.invalidateQueries({ queryKey: ['user-portal', 'keys'] })

  const handleStatus = async (key: ApiKey) => {
    const next =
      key.status === API_KEY_STATUS.ENABLED
        ? API_KEY_STATUS.DISABLED
        : API_KEY_STATUS.ENABLED
    try {
      requireServerSuccess(await updateApiKeyStatus(key.id, next))
      toast.success(
        t(
          next === API_KEY_STATUS.ENABLED
            ? SUCCESS_MESSAGES.API_KEY_ENABLED
            : SUCCESS_MESSAGES.API_KEY_DISABLED
        )
      )
      await refreshKeys()
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.STATUS_UPDATE_FAILED))
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      requireServerSuccess(await deleteApiKey(pendingDelete.id))
      toast.success(t(SUCCESS_MESSAGES.API_KEY_DELETED))
      setPendingDelete(null)
      await refreshKeys()
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.DELETE_FAILED))
    } finally {
      setDeleting(false)
    }
  }

  let body: ReactNode
  if (listQuery.isError) {
    body = (
      <ErrorState
        title={t(ERROR_MESSAGES.LOAD_FAILED)}
        onRetry={() => {
          void listQuery.refetch()
        }}
      />
    )
  } else if (listQuery.isLoading) {
    body = (
      <div className='space-y-3'>
        {['a', 'b', 'c'].map((id) => (
          <Skeleton key={id} className='h-28 rounded-2xl' />
        ))}
      </div>
    )
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={KeyRound}
        title={t(
          'No API keys available. Create your first API key to get started.'
        )}
        action={
          <Button
            type='button'
            className='rounded-full'
            onClick={() => setCreateOpen(true)}
          >
            <Plus className='size-3.5' />
            {t('Create API Key')}
          </Button>
        }
      />
    )
  } else {
    body = (
      <div className='space-y-3'>
        {items.map((key) => {
          const status =
            API_KEY_STATUSES[key.status] ??
            API_KEY_STATUSES[API_KEY_STATUS.DISABLED]
          const remaining = key.unlimited_quota
            ? t('Unlimited')
            : formatQuota(key.remain_quota)
          const autoGroupOrder =
            key.group === 'auto' ? (key.auto_groups ?? []).join(' → ') : ''
          return (
            <article
              key={key.id}
              className='rounded-2xl bg-[var(--portal-surface-muted)] px-5 py-4'
            >
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h2 className='text-base font-semibold text-[var(--portal-ink)]'>
                      {key.name}
                    </h2>
                    <StatusBadge
                      label={t(status.label)}
                      variant={status.variant}
                    />
                  </div>
                  <PortalKeySecret id={key.id} masked={`sk-${key.key}`} />
                </div>
                <div className='flex shrink-0 flex-wrap gap-2'>
                  {key.status === API_KEY_STATUS.EXPIRED ||
                  key.status === API_KEY_STATUS.EXHAUSTED ? null : (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='rounded-full'
                      onClick={() => {
                        void handleStatus(key)
                      }}
                    >
                      {key.status === API_KEY_STATUS.ENABLED
                        ? t('Disable')
                        : t('Enable')}
                    </Button>
                  )}
                  <Button
                    type='button'
                    variant='destructive'
                    size='sm'
                    className='rounded-full'
                    onClick={() => setPendingDelete(key)}
                  >
                    {t('Delete')}
                  </Button>
                </div>
              </div>
              <div className='mt-4 flex flex-wrap gap-x-8 gap-y-3'>
                <div>
                  <p className='text-muted-foreground text-sm'>{t('Group')}</p>
                  <div className='mt-1 flex flex-col gap-1'>
                    <GroupBadge group={key.group} />
                    {autoGroupOrder ? (
                      <p className='text-muted-foreground text-xs break-all'>
                        {autoGroupOrder}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div>
                  <p className='text-muted-foreground text-sm'>
                    {t('Remaining quota')}
                  </p>
                  <p className='mt-1 text-lg font-semibold text-[var(--portal-ink)] tabular-nums'>
                    {remaining}
                  </p>
                </div>
                <ActivityTimeCell
                  createdAt={key.created_time}
                  lastAt={key.accessed_time}
                  lastLabel={t('Last Used')}
                  now={Date.now()}
                  layout='columns'
                />
              </div>
            </article>
          )
        })}
      </div>
    )
  }

  return (
    <div className='flex w-full flex-col gap-6'>
      <header className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex flex-col gap-2'>
          <h1 className='text-2xl font-semibold text-[var(--portal-ink)]'>
            {t('Key Management')}
          </h1>
          <p className='text-muted-foreground text-sm'>
            {t('Manage credentials for API access.')}
          </p>
        </div>
        <Button
          type='button'
          size='sm'
          className='rounded-full'
          onClick={() => setCreateOpen(true)}
        >
          <Plus className='size-3.5' />
          {t('Create API Key')}
        </Button>
      </header>

      <div className='flex flex-wrap items-center justify-between gap-3 border-t pt-5'>
        <Input
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          placeholder={t('Search')}
          className='max-w-xs rounded-full'
          aria-label={t('Search')}
        />
        {total > PAGE_SIZE ? (
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='rounded-full'
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t('Previous')}
            </Button>
            <span className='text-muted-foreground text-sm tabular-nums'>
              {t('Page')} {page} {t('of')} {pageCount}
            </span>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='rounded-full'
              disabled={page >= pageCount}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('Next page')}
            </Button>
          </div>
        ) : null}
      </div>

      {body}

      <PortalKeysCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={t('Delete')}
        desc={t(
          'Are you sure you want to delete this key? This action cannot be undone.'
        )}
        confirmText={t('Delete')}
        destructive
        isLoading={deleting}
        handleConfirm={() => {
          void handleDelete()
        }}
      />
    </div>
  )
}

function PortalKeySecret(props: { id: number; masked: string }) {
  const { t } = useTranslation()
  const [fullKey, setFullKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const resolveKey = async () => {
    if (fullKey) return fullKey
    setLoading(true)
    try {
      const result = requireServerSuccess(await fetchTokenKey(props.id))
      const raw = result.data?.key ?? ''
      const next = raw.startsWith('sk-') ? raw : `sk-${raw}`
      setFullKey(next)
      return next
    } catch (error) {
      handleServerError(error, t(ERROR_MESSAGES.LOAD_FAILED))
      return ''
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    const value = await resolveKey()
    if (!value) return
    const ok = await copyToClipboard(value)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  let copyIcon = <Copy className='size-3.5' />
  if (loading) {
    copyIcon = <Loader2 className='size-3.5 animate-spin' />
  } else if (copied) {
    copyIcon = <Check className='size-3.5 text-green-600' />
  }

  return (
    <div className='mt-2 flex min-w-0 items-center gap-1'>
      <span className='text-muted-foreground truncate font-mono text-xs'>
        {props.masked}
      </span>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-7'
                aria-label={t('Copy API key')}
                onClick={() => {
                  void handleCopy()
                }}
              />
            }
          >
            {copyIcon}
          </TooltipTrigger>
          <TooltipContent>
            {copied ? t('Copied!') : t('Copy API key')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
