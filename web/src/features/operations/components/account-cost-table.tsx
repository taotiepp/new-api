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
import { dateToUnixTimestamp } from '@/lib/time'

import type { AccountMonthCost } from '../types'

type AccountCostTableProps = {
  accounts: AccountMonthCost[]
  start: Date
  end: Date
}

export function AccountCostTable(props: AccountCostTableProps) {
  const { t } = useTranslation()
  const { formatQuota } = usePricingCurrency()
  const unset = t('Unset')
  const startTime = dateToUnixTimestamp(props.start)
  const endTime = dateToUnixTimestamp(props.end)

  return (
    <StaticDataTable
      columns={[
        {
          id: 'username',
          header: t('Username'),
          cell: (account) => (
            <Link
              to='/app/usage'
              search={{
                userId: account.user_id,
                username: account.username,
                startTime,
                endTime,
              }}
              className='underline-offset-2 hover:underline'
            >
              {account.username}
            </Link>
          ),
        },
        {
          id: 'display-name',
          header: t('Display name'),
          cell: (account) => account.display_name || unset,
        },
        {
          id: 'quota',
          header: t('Monthly cost'),
          cell: (account) => formatQuota(account.quota),
        },
        {
          id: 'count',
          header: t('Requests'),
          cell: (account) => formatNumber(account.count),
        },
        {
          id: 'tokens',
          header: t('Tokens'),
          cell: (account) => formatNumber(account.token_used),
        },
      ]}
      data={props.accounts}
      getRowKey={(account) => account.user_id}
    />
  )
}
