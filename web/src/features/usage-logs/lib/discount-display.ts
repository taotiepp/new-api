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
import type { LogOtherData } from '../types'

export type AppliedDiscount = {
  ratio: number
  source?: string
}

const DISCOUNT_SOURCE_LABEL_KEYS: Record<string, string> = {
  user_group_model: 'Group model discount',
  user_group: 'User group discount',
  group_default: 'Resource group default',
  user_model: 'Model discount',
  user_default: 'Default discount',
  group_legacy: 'Group Ratio',
  channel_model: 'Channel model discount',
  channel_default: 'Channel default discount',
}

export function formatDiscountMultiplier(ratio: number): string {
  if (!Number.isFinite(ratio)) return '-'
  const compact =
    ratio % 1 === 0 ? String(ratio) : ratio.toFixed(4).replace(/\.?0+$/, '')
  return `${compact}x`
}

export function formatAppliedDiscount(
  discount: AppliedDiscount,
  t: (key: string) => string
): string {
  const multiplier = formatDiscountMultiplier(discount.ratio)
  const sourceKey = discount.source
    ? DISCOUNT_SOURCE_LABEL_KEYS[discount.source]
    : undefined
  if (!sourceKey) return multiplier
  return `${multiplier} · ${t(sourceKey)}`
}

export function getAppliedUserDiscount(
  other: LogOtherData | null | undefined
): AppliedDiscount | null {
  if (other?.user_discount == null || !Number.isFinite(other.user_discount)) {
    return null
  }
  return {
    ratio: other.user_discount,
    source: other.user_discount_source,
  }
}

export function getAppliedChannelDiscount(
  other: LogOtherData | null | undefined
): AppliedDiscount | null {
  const adminInfo = other?.admin_info
  const ratio = adminInfo?.channel_discount
  if (ratio == null || !Number.isFinite(ratio)) return null
  return {
    ratio,
    source: adminInfo?.channel_discount_source,
  }
}
