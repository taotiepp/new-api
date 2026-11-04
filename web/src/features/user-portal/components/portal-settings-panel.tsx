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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserProfile } from '@/features/profile/api'
import { usePricingCurrency } from '@/lib/currency'
import { requireServerSuccess } from '@/lib/server-error-message'

import { PortalSettingsAccount } from './portal-settings-account'
import { PortalSettingsLanguage } from './portal-settings-language'
import { PortalSettingsNotifications } from './portal-settings-notifications'

export function PortalSettingsPanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { formatQuota } = usePricingCurrency()
  const profileQuery = useQuery({
    queryKey: ['user-portal', 'settings'],
    queryFn: async () => {
      const result = requireServerSuccess(await getUserProfile())
      if (!result.data) {
        throw new Error('missing profile')
      }
      return result.data
    },
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['user-portal', 'settings'] })
  }

  let body = null
  if (profileQuery.isError) {
    body = (
      <ErrorState
        title={t('Failed to load profile')}
        onRetry={() => {
          void profileQuery.refetch()
        }}
      />
    )
  } else if (profileQuery.isLoading || !profileQuery.data) {
    body = (
      <div className='space-y-3'>
        <Skeleton className='h-24 rounded-none' />
        <Skeleton className='h-16 rounded-none' />
        <Skeleton className='h-40 rounded-none' />
      </div>
    )
  } else {
    const profile = profileQuery.data
    body = (
      <>
        <PortalSettingsAccount
          profile={profile}
          balance={formatQuota(profile.quota)}
          usage={formatQuota(profile.used_quota)}
        />
        <PortalSettingsLanguage profile={profile} onSaved={refresh} />
        <PortalSettingsNotifications profile={profile} onSaved={refresh} />
      </>
    )
  }

  return (
    <div className='flex w-full flex-col gap-6'>
      <header className='flex flex-col gap-2'>
        <h1 className='text-2xl font-semibold text-[var(--portal-ink)]'>
          {t('System Settings')}
        </h1>
        <p className='text-muted-foreground text-sm'>
          {t('Account, balance, notifications, and language.')}
        </p>
      </header>
      {body}
    </div>
  )
}
