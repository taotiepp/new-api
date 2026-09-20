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
import { describe, expect, test } from 'vitest'

import type { User } from '../../types'
import {
  transformFormDataToPayload,
  transformUserToFormDefaults,
} from '../user-form'

const user: User = {
  id: 9,
  username: 'alice',
  display_name: 'Alice',
  role: 1,
  status: 1,
  quota: 500000,
  used_quota: 0,
  request_count: 0,
  group: 'vip',
  discount: 0.8,
  model_discounts: '{"gpt-4o":0.5}',
}

describe('user form discount payload', () => {
  test('folds legacy user discounts into the assigned resource group', () => {
    const defaults = transformUserToFormDefaults(user, ['vip', 'default'])
    expect(defaults.group_discount_entries).toEqual([
      { group: 'default', discount: null, model_discounts: [] },
      {
        group: 'vip',
        discount: 0.8,
        model_discounts: [{ id: 'discount-gpt-4o', model: 'gpt-4o', discount: 0.5 }],
      },
    ])
  })

  test('saves group-scoped discounts and clears the global fields', () => {
    const payload = transformFormDataToPayload(
      {
        username: 'alice',
        display_name: 'Alice',
        group: 'vip',
        group_discount_entries: [
          {
            group: 'vip',
            discount: 0.8,
            model_discounts: [{ model: 'gpt-4o', discount: 0.5 }],
          },
          { group: 'default', discount: null, model_discounts: [] },
        ],
      },
      9
    )
    expect(payload.discount).toBeNull()
    expect(payload.model_discounts).toBe('')
    expect(payload.group_discounts).toBe('{"vip":0.8}')
    expect(payload.group_model_discounts).toBe('{"vip":{"gpt-4o":0.5}}')
  })
})
