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
import type { TFunction } from 'i18next'

import type { PricingModel } from '../types'
import { formatRateLimit } from './mock-stats'

export function getUserRateLimitDisplay(model: PricingModel, t: TFunction) {
  if (typeof model.rpm !== 'number' && typeof model.tpm !== 'number') return []
  const windowSeconds = model.rate_limit_window_seconds ?? 60
  const windowLabel = `${t('Window:')} ${windowSeconds} ${t('seconds')}`
  return [
    {
      key: 'requests',
      label: windowSeconds === 60 ? t('RPM') : t('Requests'),
      value:
        model.rpm != null && model.rpm > 0
          ? formatRateLimit(model.rpm)
          : t('Unlimited'),
      hint: windowSeconds === 60 ? t('Requests per minute') : windowLabel,
    },
    {
      key: 'tokens',
      label: windowSeconds === 60 ? t('TPM') : t('Tokens'),
      value:
        model.tpm != null && model.tpm > 0
          ? formatRateLimit(model.tpm)
          : t('Unlimited'),
      hint: windowSeconds === 60 ? t('Tokens per minute') : windowLabel,
    },
  ]
}
