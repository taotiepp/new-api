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
import { useTranslation } from 'react-i18next'

import { formatQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

type UserPortalQuotaSummaryProps = {
  compact?: boolean
}

export function UserPortalQuotaSummary(props: UserPortalQuotaSummaryProps) {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)

  if (props.compact) {
    return (
      <span className='block truncate tabular-nums'>
        <span className='text-[var(--portal-ink)]'>{formatQuota(user?.quota ?? 0)}</span>
        <span className='text-[var(--portal-ink-muted)]'> · {t('Available balance')}</span>
      </span>
    )
  }

  return (
    <div className='portal-bezel-inner p-4'>
      <p className='text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--portal-ink-muted)]'>
        {t('Available balance')}
      </p>
      <p className='mt-1.5 text-lg font-semibold tabular-nums tracking-tight text-[var(--portal-ink)]'>
        {formatQuota(user?.quota ?? 0)}
      </p>
      {user?.used_quota !== undefined ? (
        <p className='mt-1 text-[11px] text-[var(--portal-ink-muted)]'>
          {t('Used')}: {formatQuota(user.used_quota)}
        </p>
      ) : null}
    </div>
  )
}
