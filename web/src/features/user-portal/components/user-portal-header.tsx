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
import { ArrowLeftIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PricingCurrencySwitch } from '@/components/pricing-currency-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { PortalNavLinks } from './portal-nav-links'
import { UserPortalQuotaSummary } from './user-portal-quota-summary'

export function UserPortalHeader() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.auth.user)
  const isAdmin = (user?.role ?? ROLE.GUEST) >= ROLE.ADMIN
  const { status } = useStatus()
  const { logo } = useSystemConfig()
  const systemName = status?.system_name || 'New API'

  return (
    <div className='portal-top-chrome'>
      <div className='portal-island'>
        <Link className='portal-island-brand' to='/app'>
          <img
            src={logo}
            alt={t('Logo')}
            className='size-9 rounded-xl object-cover shadow-sm ring-1 ring-black/5'
          />
          <span className='hidden min-w-0 truncate text-base font-semibold tracking-tight text-[var(--portal-ink)] sm:inline'>
            {systemName}
          </span>
        </Link>

        <nav aria-label={t('User Portal navigation')} className='portal-island-nav'>
          <PortalNavLinks layout='island' />
        </nav>

        <div className='portal-island-actions'>
          {user ? (
            <div className='portal-quota-chip'>
              <UserPortalQuotaSummary compact />
            </div>
          ) : null}
          {isAdmin ? (
            <Button
              nativeButton={false}
              render={<Link to='/dashboard' />}
              size='icon-sm'
              variant='ghost'
              className='rounded-full'
              aria-label={t('Back to Console')}
            >
              <ArrowLeftIcon aria-hidden className='size-4' />
            </Button>
          ) : null}
          <PricingCurrencySwitch />
          <ThemeSwitch />
          {user ? (
            <ProfileDropdown />
          ) : (
            <Button
              size='sm'
              variant='secondary'
              className='h-9 rounded-full px-4 text-sm font-medium'
              render={<Link to='/sign-in' />}
            >
              {t('Sign in')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
