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
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/language-switcher'
import { PricingCurrencySwitch } from '@/components/pricing-currency-switch'
import { ThemeSwitch } from '@/components/theme-switch'
import { Skeleton } from '@/components/ui/skeleton'
import { PortalBezel } from '@/components/layout/portal/portal-bezel'
import { PortalPublicShell } from '@/components/layout/portal/portal-public-shell'
import { useSystemConfig } from '@/hooks/use-system-config'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <PortalPublicShell
      header={
        <div className='portal-top-chrome'>
          <div className='portal-island'>
            <Link className='portal-island-brand' to='/'>
              <div className='relative size-9'>
                {loading ? (
                  <Skeleton className='absolute inset-0 rounded-xl' />
                ) : (
                  <img
                    src={logo}
                    alt={t('Logo')}
                    className='size-9 rounded-xl object-cover shadow-sm ring-1 ring-black/5'
                  />
                )}
              </div>
              {loading ? (
                <Skeleton className='h-4 w-24' />
              ) : (
                <span className='hidden max-w-[16rem] truncate text-base font-semibold tracking-tight text-[var(--portal-ink)] sm:inline'>
                  {systemName}
                </span>
              )}
            </Link>
            <div className='ml-auto portal-island-actions'>
              <LanguageSwitcher />
              <PricingCurrencySwitch />
              <ThemeSwitch />
            </div>
          </div>
        </div>
      }
    >
      <main className='portal-auth-stage'>
        <PortalBezel className='portal-auth-card' innerClassName='p-6 sm:p-8'>
          {children}
        </PortalBezel>
      </main>
    </PortalPublicShell>
  )
}
