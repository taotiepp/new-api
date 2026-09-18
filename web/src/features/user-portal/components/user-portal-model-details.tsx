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
import { ArrowLeft, KeyRound, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ModelDetailsContent } from '@/features/pricing/components/model-details'
import { DEFAULT_TOKEN_UNIT } from '@/features/pricing/constants'
import type { TokenUnit } from '@/features/pricing/types'

import { usePortalCatalogData } from '../hooks/use-portal-catalog-data'
import { PortalBezel } from './portal-bezel'
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
        <Skeleton className='mb-4 h-32 w-full rounded-[var(--portal-radius-lg)]' />
        <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
          {MODEL_DETAILS_SKELETON_KEYS.map((key) => (
            <Skeleton key={key} className='h-16 w-full rounded-xl' />
          ))}
        </div>
      </UserPortalPage>
    )
  }

  if (!model) {
    return (
      <UserPortalPage title={t('Model not found')} centeredHero>
        <PortalBezel className='max-w-lg' innerClassName='p-6'>
          <p className='text-muted-foreground mb-4 text-sm'>
            {t("The model you're looking for doesn't exist.")}
          </p>
          <Button onClick={handleBack} variant='outline' size='sm'>
            {t('Back to Models')}
          </Button>
        </PortalBezel>
      </UserPortalPage>
    )
  }

  const summary = model.description?.trim()

  const headerActions = (
    <>
      <Button
        variant='ghost'
        size='sm'
        onClick={handleBack}
        className='text-muted-foreground hover:text-foreground h-9 gap-1 rounded-full px-3'
      >
        <ArrowLeft className='size-3.5' />
        {t('Back')}
      </Button>
      <Button
        size='sm'
        className='rounded-full shadow-md'
        render={
          <Link to='/app/playground' search={{ model: model.model_name }} />
        }
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
        {t('Create API Key')}
      </Button>
    </>
  )

  return (
    <UserPortalPage
      eyebrow={t('Model Square')}
      title={
        <span className='font-mono tracking-tight'>{model.model_name}</span>
      }
      description={summary ? summary : t('No description available.')}
      actions={headerActions}
    >
      <PortalBezel innerClassName='p-6 sm:p-8'>
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
      </PortalBezel>
    </UserPortalPage>
  )
}
