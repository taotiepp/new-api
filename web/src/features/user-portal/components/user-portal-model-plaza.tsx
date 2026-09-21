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
import { KeyRound, Sparkles } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  EmptyState,
  LoadingSkeleton,
} from '@/features/pricing/components'
import { VIEW_MODES } from '@/features/pricing/constants'

import { useAppPricingFilters } from '../hooks/use-app-pricing-filters'
import { usePortalCatalogData } from '../hooks/use-portal-catalog-data'
import { PORTAL_VENDOR_ALL } from '../lib/catalog-filters'
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
    setSearchInput,
    setVendorFilter,
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
      <Button
        size='sm'
        className='rounded-full shadow-md'
        render={<Link to='/app/playground' />}
      >
        <Sparkles className='size-3.5' />
        {t('Try Online')}
      </Button>
      <Button
        size='sm'
        variant='outline'
        className='rounded-full border-border/70 bg-background/80'
        render={<Link to='/app/keys' />}
      >
        <KeyRound className='size-3.5' />
        {t('API Keys')}
      </Button>
    </>
  )

  if (isLoading) {
    return (
      <UserPortalPage
        title={t('Model Square')}
        actions={headerActions}
      >
        <div className='portal-catalog-section'>
          <LoadingSkeleton viewMode={VIEW_MODES.CARD} />
        </div>
      </UserPortalPage>
    )
  }

  return (
    <UserPortalPage
      title={t('Model Square')}
      actions={headerActions}
    >
      <div className='portal-catalog-section space-y-5'>
        <PortalCatalogToolbar
          totalCount={models.length}
          filteredCount={filteredModels.length}
          vendorFilter={vendorFilter}
          vendors={vendors}
          onVendorChange={setVendorFilter}
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
              vendorFilter !== PORTAL_VENDOR_ALL || Boolean(searchInput)
            }
            onClearFilters={handleClearAll}
          />
        ) : (
          <PortalModelGrid
            models={filteredModels}
            filterKey={`${vendorFilter}:${searchInput}`}
            groupByVendor={vendorFilter === PORTAL_VENDOR_ALL}
            onModelClick={handleModelClick}
            priceRate={priceRate}
            usdExchangeRate={usdExchangeRate}
          />
        )}
      </div>
    </UserPortalPage>
  )
}
