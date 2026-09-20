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
import { useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { formatLogQuota } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getChannelSettlement } from '../api'
import { buildApiParams } from '../lib/utils'
import type { ChannelSettlementRow } from '../types'

export function ChannelSettlementDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const searchParams = useSearch({ strict: false })

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['channel-settlement', searchParams],
    enabled: props.open,
    queryFn: async () => {
      const params = buildApiParams({
        page: 1,
        pageSize: 1,
        searchParams,
        columnFilters: [],
        isAdmin: true,
      })
      const result = requireServerSuccess(
        await getChannelSettlement({
          start_timestamp: params.start_timestamp,
          end_timestamp: params.end_timestamp,
          model_name: params.model_name,
          channel: params.channel,
        })
      )
      return result.data ?? []
    },
  })

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Channel settlement')}
      description={t(
        'Customer quota, inbound cost, and margin aggregated by channel for the current filters.'
      )}
      contentClassName='sm:max-w-2xl'
    >
      {isLoading ? (
        <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
      ) : null}
      {!isLoading && rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          {t('No settlement rows in this range.')}
        </p>
      ) : null}
      {!isLoading && rows.length > 0 ? (
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-muted-foreground border-b text-left'>
                <th className='py-2 pr-3 font-medium'>{t('Channel')}</th>
                <th className='py-2 pr-3 font-medium'>{t('Customer quota')}</th>
                <th className='py-2 pr-3 font-medium'>{t('Channel cost')}</th>
                <th className='py-2 font-medium'>{t('Margin')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: ChannelSettlementRow) => {
                const margin = (row.quota || 0) - (row.cost_quota || 0)
                return (
                  <tr key={row.channel} className='border-b last:border-0'>
                    <td className='py-2 pr-3 font-mono'>#{row.channel}</td>
                    <td className='py-2 pr-3 font-mono'>
                      {formatLogQuota(row.quota || 0)}
                    </td>
                    <td className='py-2 pr-3 font-mono'>
                      {formatLogQuota(row.cost_quota || 0)}
                    </td>
                    <td
                      className={
                        margin < 0
                          ? 'text-destructive py-2 font-mono'
                          : 'py-2 font-mono'
                      }
                    >
                      {formatLogQuota(margin)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </Dialog>
  )
}

export function ChannelSettlementButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type='button'
        variant='outline'
        size='sm'
        className='h-7'
        onClick={() => setOpen(true)}
      >
        {t('Settlement')}
      </Button>
      <ChannelSettlementDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
