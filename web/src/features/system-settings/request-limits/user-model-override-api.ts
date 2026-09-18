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

import type { TokenMode } from './user-model-rate-limit-config'

export type UserModelRateLimitRow = {
  id: number
  user_id: number
  model_name: string
  rpm: number
  tpm: number
  token_mode: TokenMode
  enabled: boolean
  created_time: number
  updated_time: number
}

export type UserModelRateLimitListData = {
  items: UserModelRateLimitRow[]
  total: number
  page: number
  page_size: number
}

export type UserModelRateLimitListParams = {
  userId?: number
  page?: number
  pageSize?: number
}

export type UserModelRateLimitInput = {
  id?: number
  user_id: number
  model_name: string
  rpm: number
  tpm: number
  token_mode: TokenMode
  enabled: boolean
}

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  data?: T
}

export const userModelOverrideQueryKeys = {
  all: ['user-model-rate-limits'] as const,
  lists: () => [...userModelOverrideQueryKeys.all, 'list'] as const,
  list: (params: UserModelRateLimitListParams) =>
    [...userModelOverrideQueryKeys.lists(), params] as const,
}

export async function listUserModelRateLimits(
  params: UserModelRateLimitListParams = {}
): Promise<ApiEnvelope<UserModelRateLimitListData>> {
  const query = new URLSearchParams()
  if (params.userId && params.userId > 0) {
    query.set('user_id', String(params.userId))
  }
  query.set('p', String(params.page ?? 1))
  query.set('page_size', String(params.pageSize ?? 20))
  const res = await api.get(`/api/user_model_rate_limit/?${query.toString()}`)
  return res.data
}

export async function createUserModelRateLimit(
  body: UserModelRateLimitInput
): Promise<ApiEnvelope<UserModelRateLimitRow>> {
  const res = await api.post('/api/user_model_rate_limit/', body)
  return res.data
}

export async function updateUserModelRateLimit(
  body: UserModelRateLimitInput
): Promise<ApiEnvelope<UserModelRateLimitRow>> {
  const res = await api.put('/api/user_model_rate_limit/', body)
  return res.data
}

export async function deleteUserModelRateLimit(
  id: number
): Promise<ApiEnvelope<boolean>> {
  const res = await api.delete(`/api/user_model_rate_limit/${id}`)
  return res.data
}
