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

import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getDisplayName } from '@/features/profile/lib'
import type { UserProfile } from '@/features/profile/types'
import { getUserAvatarFallback, getUserAvatarStyle } from '@/lib/avatar'
import { formatCompactNumber } from '@/lib/format'
import { getRoleLabelKey } from '@/lib/roles'

type PortalSettingsAccountProps = {
  profile: UserProfile
  balance: string
  usage: string
}

export function PortalSettingsAccount(props: PortalSettingsAccountProps) {
  const { t } = useTranslation()
  const displayName = getDisplayName(props.profile)
  const avatarName = props.profile.username || displayName

  const stats = [
    {
      label: t('Current Balance'),
      value: props.balance,
      hint: t('Remaining quota'),
    },
    {
      label: t('Total Usage'),
      value: props.usage,
      hint: t('Total consumed quota'),
    },
    {
      label: t('Total requests'),
      value: formatCompactNumber(props.profile.request_count),
      hint: t('Total requests made'),
    },
  ]

  return (
    <section className='border-t border-[var(--portal-hairline)] pt-6'>
      <div className='flex flex-wrap items-center gap-4'>
        <Avatar className='size-12'>
          <AvatarFallback
            className='text-lg font-semibold text-white'
            style={getUserAvatarStyle(avatarName)}
          >
            {getUserAvatarFallback(avatarName)}
          </AvatarFallback>
        </Avatar>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='truncate text-xl font-semibold text-[var(--portal-ink)]'>
              {displayName}
            </h2>
            <StatusBadge
              label={t(getRoleLabelKey(props.profile.role))}
              variant='neutral'
              copyable={false}
            />
          </div>
          <p className='text-muted-foreground mt-1 text-sm'>
            @{props.profile.username}
            {props.profile.email ? ` · ${props.profile.email}` : ''}
          </p>
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            <GroupBadge group={props.profile.group} />
            <StatusBadge
              label={`${t('User ID')} ${props.profile.id}`}
              variant='info'
              copyText={String(props.profile.id)}
            />
          </div>
        </div>
      </div>
      <div className='mt-5 grid gap-6 border-t border-[var(--portal-hairline)] pt-4 sm:grid-cols-3'>
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className='text-muted-foreground text-sm'>{stat.label}</p>
            <p className='mt-1 text-lg font-semibold text-[var(--portal-ink)] tabular-nums'>
              {stat.value}
            </p>
            <p className='text-muted-foreground mt-1 text-xs'>{stat.hint}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
