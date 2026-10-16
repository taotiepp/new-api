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
import { Link, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/features/pricing/components'

import { useAppPricingFilters } from '../hooks/use-app-pricing-filters'
import { usePortalCatalogData } from '../hooks/use-portal-catalog-data'
import { PORTAL_GROUP_ALL, PORTAL_VENDOR_ALL } from '../lib/catalog-filters'
import { PortalCatalogToolbar } from './portal-catalog-toolbar'
import { PortalModelGrid } from './portal-model-grid'
import { PortalSearch } from './portal-search'
import { UserPortalPage } from './user-portal-page'

export function UserPortalModelPlaza() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { models, isLoading, priceRate, usdExchangeRate } =
    usePortalCatalogData()

  const {
    searchInput,
    vendorFilter,
    vendors,
    groupFilter,
    groups,
    setSearchInput,
    setVendorFilter,
    setGroupFilter,
    filteredModels,
    clearSearch,
    clearFilters,
  } = useAppPricingFilters(models)

  const handleModelClick = useCallback(
    (modelName: string) => {
      void navigate({
        to: '/app/models/$modelId',
        params: { modelId: modelName },
      })
    },
    [navigate],
  )

  const handleClearAll = useCallback(() => {
    clearFilters()
  }, [clearFilters])

  const headerActions = (
    <>
      <Button size='sm' render={<Link to='/app/playground' />}>
        {t('Try Online')}
      </Button>
      <Button
        size='sm'
        variant='outline'
        render={<Link to='/app/keys' />}
      >
        {t('API Keys')}
      </Button>
    </>
  )

  if (isLoading) {
    return (
      <UserPortalPage
        title={t('Model Square')}
        description={t(
          'Compare price, context, and vendor, then open a model.'
        )}
        actions={headerActions}
      >
        <div className='portal-catalog-section border-t border-[var(--portal-hairline)]'>
          {['a', 'b', 'c', 'd', 'e', 'f'].map((id) => (
            <Skeleton key={id} className='my-3 h-10 rounded-none' />
          ))}
        </div>
      </UserPortalPage>
    )
  }

  return (
    <UserPortalPage
      title={t('Model Square')}
      description={t(
        'Compare price, context, and vendor, then open a model.'
      )}
      actions={headerActions}
    >
      <div className='portal-catalog-section space-y-5'>
        <PortalCatalogToolbar
          totalCount={models.length}
          filteredCount={filteredModels.length}
          vendorFilter={vendorFilter}
          vendors={vendors}
          onVendorChange={setVendorFilter}
          groupFilter={groupFilter}
          groups={groups}
          onGroupChange={setGroupFilter}
          trailing={
            <PortalSearch
              className='w-full sm:w-72'
              value={searchInput}
              onChange={setSearchInput}
              onClear={clearSearch}
              placeholder={t('Search models...')}
            />
          }
        />
        {filteredModels.length === 0 ? (
          <EmptyState
            searchQuery={searchInput}
            hasActiveFilters={
              vendorFilter !== PORTAL_VENDOR_ALL ||
              groupFilter !== PORTAL_GROUP_ALL ||
              Boolean(searchInput)
            }
            onClearFilters={handleClearAll}
          />
        ) : (
          <PortalModelGrid
            models={filteredModels}
            filterKey={`${groupFilter}:${vendorFilter}:${searchInput}`}
            onModelClick={handleModelClick}
            priceRate={priceRate}
            usdExchangeRate={usdExchangeRate}
          />
        )}
      </div>
    </UserPortalPage>
  )
}
