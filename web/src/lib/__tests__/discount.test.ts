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

import {
  parseModelDiscounts,
  resolveUserDisplayDiscount,
  serializeModelDiscounts,
} from '../discount'

describe('discount helpers', () => {
  test('parses model discounts and drops invalid values', () => {
    expect(
      parseModelDiscounts('{"gpt-4o":0.2,"bad":-1,"empty":""}')
    ).toEqual({ 'gpt-4o': 0.2 })
  })

  test('serializes only named finite discounts', () => {
    expect(
      serializeModelDiscounts([
        { model: ' gpt-4o ', discount: 0.5 },
        { model: '', discount: 0.1 },
        { model: 'bad', discount: -1 },
      ])
    ).toBe('{"gpt-4o":0.5}')
  })

  test('uses catalog price when the visitor is not signed in', () => {
    expect(resolveUserDisplayDiscount('gpt-4o', null, { vip: 0.6 })).toBe(1)
  })

  test('resolves discounts for the selected resource group only', () => {
    const user = {
      group: 'vip',
      group_discounts: '{"vip":0.5,"pro":0.9}',
      group_model_discounts: '{"vip":{"gpt-4o":0.2}}',
    }
    expect(resolveUserDisplayDiscount('gpt-4o', user, { vip: 0.6, pro: 0.8 }, 'vip')).toBe(0.2)
    expect(resolveUserDisplayDiscount('claude', user, { vip: 0.6, pro: 0.8 }, 'vip')).toBe(0.5)
    expect(resolveUserDisplayDiscount('gpt-4o', user, { vip: 0.6, pro: 0.8 }, 'pro')).toBe(0.9)
    expect(resolveUserDisplayDiscount('gpt-4o', { group: 'vip' }, { vip: 0.6 }, 'vip')).toBe(0.6)
  })
})
