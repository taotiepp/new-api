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

import {
  getFlowQuotaDates,
  getUserQuotaDates,
} from '@/features/dashboard/api'
import { getApiKeys } from '@/features/keys/api'
import { requireServerSuccess } from '@/lib/server-error-message'
import { computeTimeRange } from '@/lib/time'

import {
  isPortalBillingRangeTooLong,
  type PortalBillingRow,
  type PortalFlowRow,
} from '../lib/billing'

export function usePortalBillingData(start: Date, end: Date) {
  const rangeTooLong = isPortalBillingRangeTooLong(start, end)
  const timeRange = computeTimeRange(1, start, end)

  const quotaQuery = useQuery({
    queryKey: ['user-portal', 'billing', 'quota', timeRange],
    enabled: !rangeTooLong,
    queryFn: async () => {
      const result = requireServerSuccess(
        await getUserQuotaDates(
          {
            start_timestamp: timeRange.start_timestamp,
            end_timestamp: timeRange.end_timestamp,
          },
          false,
        ),
      )
      return (result.data ?? []) as PortalBillingRow[]
    },
  })

  const flowQuery = useQuery({
    queryKey: ['user-portal', 'billing', 'flow', timeRange],
    enabled: !rangeTooLong,
    queryFn: async () => {
      const result = requireServerSuccess(
        await getFlowQuotaDates(
          {
            start_timestamp: timeRange.start_timestamp,
            end_timestamp: timeRange.end_timestamp,
          },
          false,
        ),
      )
      return (result.data ?? []) as PortalFlowRow[]
    },
  })

  const keysQuery = useQuery({
    queryKey: ['user-portal', 'billing', 'api-keys'],
    queryFn: async () => {
      const result = requireServerSuccess(
        await getApiKeys({ p: 1, size: 100 }),
      )
      return result.data?.items ?? []
    },
    staleTime: 60 * 1000,
  })

  return {
    rangeTooLong,
    quotaRows: quotaQuery.data ?? [],
    flowRows: flowQuery.data ?? [],
    apiKeys: keysQuery.data ?? [],
    isLoading:
      !rangeTooLong &&
      (quotaQuery.isLoading || flowQuery.isLoading || keysQuery.isLoading),
    isError: quotaQuery.isError || flowQuery.isError || keysQuery.isError,
  }
}
