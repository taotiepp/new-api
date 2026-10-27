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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type {
  AccountMonthCostList,
  AccountOperations,
  AccountOperationsUpdate,
} from './types'

export async function getAccountMonthCosts(params: {
  period: string
  keyword: string
  page: number
}): Promise<AccountMonthCostList> {
  const response = await api.get<{ success: boolean; data: AccountMonthCostList }>(
    '/api/data/accounts',
    {
      params: {
        period: params.period,
        keyword: params.keyword,
        p: params.page,
        page_size: 20,
      },
      skipErrorHandler: true,
    }
  )
  return requireServerSuccess(response.data).data
}

export async function getAccountOperations(
  userId: number
): Promise<AccountOperations> {
  const response = await api.get<{ success: boolean; data: AccountOperations }>(
    `/api/user/${userId}/operations`,
    { skipErrorHandler: true }
  )
  return requireServerSuccess(response.data).data
}

export async function updateAccountOperations(
  userId: number,
  body: AccountOperationsUpdate
): Promise<void> {
  const response = await api.put<{ success: boolean }>(
    `/api/user/${userId}/operations`,
    body,
    { skipErrorHandler: true }
  )
  requireServerSuccess(response.data)
}
