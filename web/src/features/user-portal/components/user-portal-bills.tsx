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
import type { PortalSubjectUser } from '../hooks/use-portal-subject-user'
import { PortalBillPanel } from './portal-bill-panel'
import { UserPortalPage } from './user-portal-page'

type UserPortalBillsProps = {
  subject?: PortalSubjectUser
  period?: string
}

export function UserPortalBills(props: UserPortalBillsProps) {
  return (
    <UserPortalPage framed={false}>
      <PortalBillPanel
        initialPeriod={props.period}
        initialSubject={props.subject}
      />
    </UserPortalPage>
  )
}
