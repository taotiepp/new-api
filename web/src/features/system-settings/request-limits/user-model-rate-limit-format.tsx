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
import type { ReactNode } from 'react'

import type { TokenMode } from './user-model-rate-limit-config'

type TranslateFn = (key: string) => string

// formatLimitValue renders a single RPM/TPM limit value: -1 is unlimited,
// 0 inherits from a less specific level, otherwise the concrete number.
export function formatLimitValue(value: number, t: TranslateFn): string {
  if (value === -1) return t('Unlimited')
  if (value === 0) return t('Inherit')
  return value.toLocaleString()
}

export function formatLimitCell(value: number, t: TranslateFn): ReactNode {
  return <span className='font-mono'>{formatLimitValue(value, t)}</span>
}

export function formatTokenMode(mode: TokenMode | string, t: TranslateFn): string {
  if (mode === 'input') return t('Input only')
  if (mode === 'total') return t('Total')
  return t('Inherit')
}
