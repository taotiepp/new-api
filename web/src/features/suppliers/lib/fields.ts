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

export type SupplierFieldKey =
  | 'tpm'
  | 'rpm'
  | 'payment_method'
  | 'company_entity'

export type SupplierField = {
  key: SupplierFieldKey
  kind: 'count' | 'text'
  labelKey: string
  maxLength?: number
}

// Add a commercial attribute here and on SupplierProfile. The stored JSON
// keeps unknown keys, so a newer attribute still round-trips through this build.
export const SUPPLIER_PROFILE_FIELDS: SupplierField[] = [
  { key: 'tpm', kind: 'count', labelKey: 'Supported TPM' },
  { key: 'rpm', kind: 'count', labelKey: 'Supported RPM' },
  {
    key: 'payment_method',
    kind: 'text',
    labelKey: 'Payment method',
    maxLength: 80,
  },
  {
    key: 'company_entity',
    kind: 'text',
    labelKey: 'Company entity',
    maxLength: 120,
  },
]
