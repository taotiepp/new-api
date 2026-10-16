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
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ModelDetailsContent } from '@/features/pricing/components/model-details'
import { DEFAULT_TOKEN_UNIT } from '@/features/pricing/constants'
import type { TokenUnit } from '@/features/pricing/types'

import { usePortalCatalogData } from '../hooks/use-portal-catalog-data'
import { UserPortalPage } from './user-portal-page'

const MODEL_DETAILS_SKELETON_KEYS = ['a', 'b', 'c', 'd'] as const

export function UserPortalModelDetails() {
  const { t } = useTranslation()
  const { modelId } = useParams({ strict: false }) as { modelId?: string }
  const search = useSearch({ strict: false }) as { tokenUnit?: TokenUnit }
  const navigate = useNavigate()

  const {
    models,
    endpointMap,
    isLoading,
    priceRate,
    usdExchangeRate,
  } = usePortalCatalogData()

  const tokenUnit: TokenUnit =
    search.tokenUnit === 'K' ? 'K' : DEFAULT_TOKEN_UNIT

  const model = useMemo(() => {
    if (!models || !modelId) return null
    return models.find((item) => item.model_name === modelId) || null
  }, [models, modelId])

  const handleBack = () => {
    void navigate({ to: '/app' })
  }

  if (isLoading) {
    return (
      <UserPortalPage>
        <Skeleton className='mb-4 h-16 w-full rounded-none' />
        <div className='grid grid-cols-2 gap-2 border-t border-[var(--portal-hairline)] sm:grid-cols-4'>
          {MODEL_DETAILS_SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className='h-16 w-full rounded-none' />
          ))}
        </div>
      </UserPortalPage>
    )
  }

  if (!model) {
    return (
      <UserPortalPage title={t('Model not found')}>
        <p className='text-muted-foreground mb-4 border-t border-[var(--portal-hairline)] pt-4 text-sm'>
          {t("The model you're looking for doesn't exist.")}
        </p>
        <Button onClick={handleBack} variant='outline' size='sm'>
          {t('Back to Models')}
        </Button>
      </UserPortalPage>
    )
  }

  const summary = model.description?.trim()

  const headerActions = (
    <>
      <Button variant='ghost' size='sm' onClick={handleBack}>
        {t('Back')}
      </Button>
      <Button
        size='sm'
        render={
          <Link to='/app/playground' search={{ model: model.model_name }} />
        }
      >
        {t('Try Online')}
      </Button>
      <Button size='sm' variant='outline' render={<Link to='/app/keys' />}>
        {t('Create API Key')}
      </Button>
    </>
  )

  return (
    <UserPortalPage
      title={model.model_name}
      description={summary ? summary : t('No description available.')}
      actions={headerActions}
    >
      <div className='border-t border-[var(--portal-hairline)] pt-6'>
        <ModelDetailsContent
          model={model}
          groupRatio={{}}
          usableGroup={{}}
          autoGroups={[]}
          priceRate={priceRate ?? 1}
          usdExchangeRate={usdExchangeRate ?? 1}
          tokenUnit={tokenUnit}
          showRechargePrice={false}
          catalogPresentation='user_portal'
          endpointMap={
            (endpointMap as Record<
              string,
              { path?: string; method?: string }
            >) || {}
          }
        />
      </div>
    </UserPortalPage>
  )
}
