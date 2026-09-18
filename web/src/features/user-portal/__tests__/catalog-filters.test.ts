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
import { describe, expect, it } from 'vitest'

import type { PricingModel } from '@/features/pricing/types'

import {
  filterPortalCatalogBySearch,
  filterPortalCatalogByVendor,
  groupPortalCatalogModels,
  listPortalCatalogVendors,
  PORTAL_VENDOR_OTHER,
  sortPortalCatalogModels,
} from '../lib/catalog-filters'

const sampleModels: PricingModel[] = [
  {
    id: 1,
    model_name: 'alpha-model',
    description: 'First catalog entry',
    vendor_name: 'OpenAI',
    vendor_icon: 'OpenAI',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: [],
  },
  {
    id: 2,
    model_name: 'beta-model',
    vendor_name: 'Anthropic',
    description: 'Second entry',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: [],
  },
  {
    id: 3,
    model_name: 'gamma-model',
    description: 'Unassigned model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: [],
  },
]

describe('portal catalog filters', () => {
  it('searches by model name, description, and vendor', () => {
    expect(
      filterPortalCatalogBySearch(sampleModels, 'alpha').map(
        (m) => m.model_name,
      ),
    ).toEqual(['alpha-model'])
    expect(
      filterPortalCatalogBySearch(sampleModels, 'Second').map(
        (m) => m.model_name,
      ),
    ).toEqual(['beta-model'])
    expect(
      filterPortalCatalogBySearch(sampleModels, 'OpenAI').map(
        (m) => m.model_name,
      ),
    ).toEqual(['alpha-model'])
  })

  it('filters and lists vendors, keeping unassigned models under Other', () => {
    expect(
      filterPortalCatalogByVendor(sampleModels, 'Anthropic').map(
        (m) => m.model_name,
      ),
    ).toEqual(['beta-model'])
    expect(
      filterPortalCatalogByVendor(sampleModels, PORTAL_VENDOR_OTHER).map(
        (m) => m.model_name,
      ),
    ).toEqual(['gamma-model'])
    expect(listPortalCatalogVendors(sampleModels)).toEqual([
      { value: 'Anthropic', name: 'Anthropic', count: 1 },
      { value: 'OpenAI', name: 'OpenAI', icon: 'OpenAI', count: 1 },
      { value: PORTAL_VENDOR_OTHER, name: '', count: 1 },
    ])
  })

  it('sorts models by vendor then name and groups adjacent vendors', () => {
    const sorted = sortPortalCatalogModels(sampleModels, 'name')
    expect(sorted.map((m) => m.model_name)).toEqual([
      'beta-model',
      'alpha-model',
      'gamma-model',
    ])
    expect(
      groupPortalCatalogModels(sorted).map((group) => [
        group.vendor,
        group.models.map((model) => model.model_name),
      ]),
    ).toEqual([
      ['Anthropic', ['beta-model']],
      ['OpenAI', ['alpha-model']],
      ['', ['gamma-model']],
    ])
  })
})
