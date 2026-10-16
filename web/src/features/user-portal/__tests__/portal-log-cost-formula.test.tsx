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

import { usageLogSchema } from '@/features/usage-logs/data/schema'

import { PortalLogDetailsDialog } from '../components/portal-log-details-dialog'

const expression = 'tier("standard", p * 69 + c * 345 + cr * 6.9 + cc * 86.25)'

function renderFormula(
  other: Record<string, unknown>,
  tokens?: {
    prompt?: number
    completion?: number
  }
) {
  const log = usageLogSchema.parse({
    id: 1,
    user_id: 1,
    created_at: 1_700_000_000,
    type: 2,
    content: '',
    username: 'alice',
    token_name: 'production',
    model_name: 'gpt-4.1',
    quota: 500000,
    prompt_tokens: tokens?.prompt ?? 800,
    completion_tokens: tokens?.completion ?? 100,
    use_time: 1,
    is_stream: false,
    channel: 1,
    token_id: 1,
    group: 'default',
    ip: '',
    request_id: 'req_formula',
    other: JSON.stringify({
      billing_mode: 'tiered_expr',
      matched_tier: 'standard',
      expr_b64: Buffer.from(expression, 'utf8').toString('base64'),
      cache_tokens: 50,
      cache_creation_tokens: 20,
      user_discount: 0.8,
      user_discount_source: 'group_default',
      ...other,
    }),
  })
  render(<PortalLogDetailsDialog log={log} onOpenChange={() => {}} />)
  return screen.getByText(/Matched Tier: standard/).textContent ?? ''
}

describe('portal log cost formula', () => {
  test('writes tiered billing as one equation with token counts and a single discount', () => {
    const formula = renderFormula({})

    expect(formula).toContain('Matched Tier: standard')
    expect(formula).toContain('Input 730 ×')
    expect(formula).toContain('Cache Read 50 ×')
    expect(formula).toContain('Cache Write 20 ×')
    expect(formula).toContain('Output 100 ×')
    expect(formula).toContain(
      ') × Customer discount 0.8x (Resource group default) ='
    )
    expect(formula).not.toContain('Dynamic Pricing')
    expect(formula).not.toContain('0.8x ×')
  })

  test('keeps Claude input tokens separate from cache tokens', () => {
    const formula = renderFormula({ claude: true }, { prompt: 800 })

    expect(formula).toContain('Input 800 ×')
    expect(formula).toContain('Cache Read 50 ×')
    expect(formula).toContain('Cache Write 20 ×')
  })
})
