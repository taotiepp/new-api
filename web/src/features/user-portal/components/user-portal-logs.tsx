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

import { UsageLogsTable } from '@/features/usage-logs/components/usage-logs-table'
import { UsageLogsProvider } from '@/features/usage-logs/components/usage-logs-provider'

import { PortalBezel } from '@/components/layout/portal/portal-bezel'
import { UserPortalPage } from './user-portal-page'

export function UserPortalLogs() {
  const { t } = useTranslation()

  return (
    <UsageLogsProvider defaultViewScope='self'>
      <UserPortalPage
        framed={false}
        fixedHeight
        eyebrow={t('User Portal')}
        title={t('Request Logs')}
        description={t('Review your API request history.')}
      >
        <PortalBezel
          className='portal-workspace-panel min-h-[min(70vh,720px)]'
          innerClassName='portal-feature-embed flex min-h-0 flex-1 flex-col overflow-hidden p-0'
        >
          <UsageLogsTable logCategory='common' />
        </PortalBezel>
      </UserPortalPage>
    </UsageLogsProvider>
  )
}
