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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table'
import { usePricingCurrency } from '@/lib/currency'
import { formatNumber } from '@/lib/format'

import type { MonthCostRow } from '../types'

type ChannelCostTableProps = {
  channels: MonthCostRow[]
  period: string
}

export function ChannelCostTable(props: ChannelCostTableProps) {
  const { t } = useTranslation()
  const { formatQuota } = usePricingCurrency()

  return (
    <StaticDataTable
      columns={[
        {
          id: 'channel',
          header: t('Channel'),
          cell: (channel) => {
            const name = channel.channel_name || `#${channel.channel_id}`
            return (
              <Link
                to='/app/costs'
                search={{
                  channelId: channel.channel_id,
                  channelName: name,
                  period: props.period,
                  view: 'channel',
                }}
                className='underline-offset-2 hover:underline'
              >
                {name}
              </Link>
            )
          },
        },
        {
          id: 'cost',
          header: t('Channel cost'),
          className: 'text-right',
          cellClassName: 'text-right font-mono',
          cell: (channel) => formatQuota(channel.cost_quota),
        },
        {
          id: 'charge',
          header: t('Billed amount'),
          className: 'text-right',
          cellClassName: 'text-right font-mono',
          cell: (channel) => formatQuota(channel.quota),
        },
        {
          id: 'count',
          header: t('Requests'),
          className: 'text-right',
          cellClassName: 'text-right font-mono',
          cell: (channel) => formatNumber(channel.count),
        },
      ]}
      data={props.channels}
      getRowKey={(channel) => channel.channel_id}
    />
  )
}
