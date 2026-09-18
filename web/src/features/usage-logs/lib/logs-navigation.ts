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
import { isUserPortalLogsPath } from '@/features/user-portal/lib/access'

import type { UsageLogsSectionId } from '../section-registry'

export function navigateToUsageLogsSection(options: {
  pathname: string
  section: UsageLogsSectionId
  search: Record<string, unknown>
  navigate: (opts: {
    to: string
    params?: { section: UsageLogsSectionId }
    search?: Record<string, unknown>
    replace?: boolean
  }) => void
}) {
  if (isUserPortalLogsPath(options.pathname)) {
    options.navigate({
      to: '/app/logs',
      search: options.search,
    })
    return
  }

  options.navigate({
    to: '/usage-logs/$section',
    params: { section: options.section },
    search: options.search,
  })
}
