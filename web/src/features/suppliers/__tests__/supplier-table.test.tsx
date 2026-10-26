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
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { SupplierTable } from '../components/supplier-table'
import type { Supplier } from '../types'

const supplier: Supplier = {
  id: 7,
  name: 'openai-main',
  groups: [
    { name: 'vip', discount: 0.9 },
    { name: 'default', discount: null },
  ],
  discount: 0.8,
  profile: {
    tpm: 1000,
    rpm: 20,
    payment_method: 'prepaid',
    company_entity: 'Acme Ltd',
    extra: { contract_no: 'A-1' },
  },
}

describe('supplier table', () => {
  test('shows channel, group, and commercial columns', () => {
    render(<SupplierTable suppliers={[supplier]} onEdit={() => undefined} />)

    expect(screen.getByText('Channel name')).toBeInTheDocument()
    expect(screen.getByText('Group discount')).toBeInTheDocument()
    expect(screen.getByText('Channel discount')).toBeInTheDocument()
    expect(screen.getByText('Supported TPM')).toBeInTheDocument()
    expect(screen.getByText('contract_no')).toBeInTheDocument()
    expect(screen.getByText('openai-main')).toBeInTheDocument()
    expect(screen.getByText('vip, default')).toBeInTheDocument()
    expect(screen.getByText('vip 0.9, default Unset')).toBeInTheDocument()
    expect(screen.getByText('0.8')).toBeInTheDocument()
    expect(screen.getByText('prepaid')).toBeInTheDocument()
    expect(screen.getByText('Acme Ltd')).toBeInTheDocument()
    expect(screen.getByText('A-1')).toBeInTheDocument()
  })
})
