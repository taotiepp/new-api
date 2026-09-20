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
import { cleanup, render, screen } from '@testing-library/react'

import i18next from 'i18next'
import { afterAll, afterEach, expect, it, vi } from 'vitest'

import { ModelDetailsApi } from '../components/model-details-api'
import type { PricingModel } from '../types'

vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))
vi.mock('@/hooks/use-status', () => ({ useStatus: () => ({ status: {} }) }))
const originalSeparator = i18next.options.nsSeparator
i18next.options.nsSeparator = false
afterEach(() => {
  cleanup()
})

it('labels a five-minute limit with its actual window instead of per minute', () => {
  const model: PricingModel = {
    id: 1,
    model_name: 'm',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: [],
    rpm: 100,
    tpm: 9000,
    rate_limit_window_seconds: 300,
  }
  render(<ModelDetailsApi model={model} endpointMap={{}} />)
  expect(screen.queryByText('Requests per minute')).not.toBeInTheDocument()
  expect(screen.queryByText('Tokens per minute')).not.toBeInTheDocument()
  expect(screen.getAllByText('Window: 300 seconds')).toHaveLength(2)
})

it('shows unlimited limits and keeps minute labels for older responses', () => {
  const model: PricingModel = {
    id: 1,
    model_name: 'm',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: [],
    rpm: 0,
    tpm: 0,
  }
  render(<ModelDetailsApi model={model} endpointMap={{}} />)
  expect(screen.getAllByText('Unlimited')).toHaveLength(2)
  expect(screen.getByText('Requests per minute')).toBeVisible()
  expect(screen.getByText('Tokens per minute')).toBeVisible()
})

afterAll(() => {
  i18next.options.nsSeparator = originalSeparator
})
