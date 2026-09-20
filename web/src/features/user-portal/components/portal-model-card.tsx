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
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  AudioLines,
  File,
  Image as ImageIcon,
  Plus,
  Type,
  Video,
} from 'lucide-react'
import { memo, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { PortalBezel } from '@/components/layout/portal/portal-bezel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ModelBillingModeBadge } from '@/features/pricing/components/model-billing-mode-badge'
import { DEFAULT_TOKEN_UNIT } from '@/features/pricing/constants'
import { useBillingTime } from '@/features/pricing/hooks/use-billing-time'
import { usePricingFormatters } from '@/features/pricing/hooks/use-pricing-formatters'
import {
  getDynamicDisplayGroupRatio,
  getDynamicPriceUnitLabelKey,
  isDynamicPricingModel,
  isUnconfiguredTaskUsageModel,
} from '@/features/pricing/lib/dynamic-price'
import { parseTags } from '@/features/pricing/lib/filters'
import { isTokenBasedModel } from '@/features/pricing/lib/model-helpers'
import { taskPriceLabel } from '@/features/pricing/lib/task-price-display'
import type {
  Modality,
  PricingModel,
  PriceType,
  TokenUnit,
} from '@/features/pricing/types'
import { getLobeIcon } from '@/lib/lobe-icon'

const TOKEN_FORMAT = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
})

const MODALITY_ICONS: Record<Modality, typeof Type> = {
  text: Type,
  image: ImageIcon,
  audio: AudioLines,
  video: Video,
  file: File,
}

type PortalModelCardProps = {
  model: PricingModel
  onClick: () => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
}

export const PortalModelCard = memo(function PortalModelCard(
  props: PortalModelCardProps
) {
  const { t, i18n } = useTranslation()
  const { formatPrice, formatRequestPrice, getDynamicPricingSummary } =
    usePricingFormatters()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'
  const iconKey = props.model.vendor_icon || props.model.icon
  const modelIcon = iconKey ? getLobeIcon(iconKey, 22) : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'
  const summary = props.model.description?.trim()
  const tags = parseTags(props.model.tags).slice(0, 2)
  const vendorLabel = props.model.vendor_name?.trim()
  const contextLength = formatCompactTokens(props.model.context_length)
  const maxOutput = formatCompactTokens(props.model.max_output_tokens)
  const inputModalities = props.model.input_modalities ?? []
  const outputModalities = props.model.output_modalities ?? []
  const isDynamicPricing = isDynamicPricingModel(props.model)
  const isUnconfiguredTaskUsage = isUnconfiguredTaskUsageModel(props.model)
  const billingTime = useBillingTime(props.model.billing_expr)
  const dynamicSummary = isDynamicPricing
    ? getDynamicPricingSummary(props.model, {
        now: billingTime === undefined ? undefined : new Date(billingTime),
        tokenUnit,
        showRechargePrice: false,
        priceRate,
        usdExchangeRate,
        groupRatioMultiplier: getDynamicDisplayGroupRatio(
          props.model,
          undefined
        ),
      })
    : null
  const dynamicPriceEntries = dynamicSummary
    ? [
        ...(dynamicSummary.isTaskUsage
          ? dynamicSummary.primaryEntries.slice(0, 3)
          : dynamicSummary.primaryEntries),
        ...dynamicSummary.secondaryEntries.filter(
          (entry) => entry.variable?.group === 'cache'
        ),
      ]
    : []

  let priceBlock: ReactNode = null
  if (isUnconfiguredTaskUsage) {
    priceBlock = (
      <p className='text-[13px] text-[var(--portal-ink-muted)]'>
        {t('Usage-based billing · price not configured')}
      </p>
    )
  } else if (dynamicPriceEntries.length > 0) {
    priceBlock = (
      <div className='flex flex-col gap-1'>
        <ModelBillingModeBadge model={props.model} appearance='caption' />
        {dynamicPriceEntries.map((entry) => {
          const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
          const label =
            entry.labelKind === 'schema'
              ? taskPriceLabel(
                  entry.description,
                  entry.shortLabel,
                  i18n.language
                )
              : t(entry.shortLabel)
          let unitSuffix = ''
          if (unitLabelKey) {
            unitSuffix = ` / ${t(unitLabelKey)}`
          } else if (isTokenBased) {
            unitSuffix = ` / ${tokenUnitLabel}`
          }
          return (
            <p
              key={entry.key}
              className='text-[13px] text-[var(--portal-ink-muted)] tabular-nums'
            >
              {label} {entry.formattedRange ?? entry.formatted}
              {unitSuffix}
            </p>
          )
        })}
        {dynamicSummary?.isTimePricing ? (
          <p className='text-[11px] text-[var(--portal-ink-muted)]'>
            {t('Current period price')}
          </p>
        ) : null}
        {dynamicSummary?.isMixedBilling ? (
          <p className='text-[11px] text-[var(--portal-ink-muted)]'>
            {t('Token or per-call pricing')}
          </p>
        ) : null}
      </div>
    )
  } else if (isDynamicPricing) {
    priceBlock = (
      <div className='flex flex-col gap-1'>
        <ModelBillingModeBadge model={props.model} appearance='caption' />
        <p className='text-[13px] text-[var(--portal-ink-muted)]'>
          {t('Dynamic Pricing')}
        </p>
      </div>
    )
  } else if (isTokenBased) {
    const rows: { type: PriceType; label: string }[] = [
      { type: 'input', label: t('Input') },
      { type: 'output', label: t('Output') },
    ]
    if (props.model.cache_ratio != null) {
      rows.push({ type: 'cache', label: t('Cached') })
    }
    if (props.model.create_cache_ratio != null) {
      rows.push({ type: 'create_cache', label: t('Cache Write') })
    }
    priceBlock = (
      <div className='flex flex-col gap-1'>
        {rows.map((row) => (
          <p
            key={row.type}
            className='text-[13px] text-[var(--portal-ink-muted)] tabular-nums'
          >
            {row.label}{' '}
            {formatPrice(
              props.model,
              row.type,
              tokenUnit,
              false,
              priceRate,
              usdExchangeRate
            )}{' '}
            / {tokenUnitLabel}
          </p>
        ))}
      </div>
    )
  } else {
    priceBlock = (
      <p className='text-[13px] text-[var(--portal-ink-muted)] tabular-nums'>
        {formatRequestPrice(props.model, false, priceRate, usdExchangeRate)} /{' '}
        {t('request')}
      </p>
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      props.onClick()
    }
  }

  return (
    <PortalBezel
      tone='card'
      className='portal-model-tile group h-full'
      innerClassName='flex h-full flex-col bg-[var(--portal-card)] p-5'
      as='article'
    >
      <div
        role='button'
        tabIndex={0}
        className='flex h-full min-h-0 flex-1 flex-col outline-none'
        onClick={props.onClick}
        onKeyDown={handleKeyDown}
      >
        <div className='flex items-start justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-2'>
            <div
              aria-hidden
              className='flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-module)]'
            >
              {modelIcon || (
                <span className='text-xs font-semibold text-[var(--portal-accent)]'>
                  {initial}
                </span>
              )}
            </div>
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant='secondary'
                className='max-w-[7rem] truncate'
              >
                {tag}
              </Badge>
            ))}
          </div>
          <div
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Button
              size='icon-sm'
              variant='ghost'
              className='size-8 rounded-full text-[var(--portal-ink-muted)]'
              aria-label={t('Try Online')}
              render={
                <Link
                  to='/app/playground'
                  search={{ model: props.model.model_name }}
                />
              }
            >
              <Plus className='size-4' />
            </Button>
          </div>
        </div>

        <h3
          className='mt-4 line-clamp-1 text-[17px] font-semibold tracking-tight [overflow-wrap:anywhere] text-[var(--portal-ink)]'
          title={props.model.model_name}
        >
          {props.model.model_name}
        </h3>
        <div className='mt-1 flex min-w-0 items-center gap-1 text-xs text-[var(--portal-ink-muted)]'>
          <span className='truncate'>{vendorLabel || t('Latest version')}</span>
          <div
            className='shrink-0'
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <CopyButton
              value={props.model.model_name}
              tooltip={t('Copy model name')}
              className='size-6'
              iconClassName='size-3'
            />
          </div>
        </div>

        <p className='mt-3 line-clamp-2 min-h-10 text-[13px] leading-relaxed text-[var(--portal-ink-muted)]'>
          {summary || t('No description available.')}
        </p>

        {inputModalities.length > 0 || outputModalities.length > 0 ? (
          <div className='mt-3 flex flex-wrap items-center gap-1.5 text-[var(--portal-ink-muted)]'>
            <ModalityIcons items={inputModalities} />
            {inputModalities.length > 0 && outputModalities.length > 0 ? (
              <ArrowRight className='size-3.5 opacity-50' />
            ) : null}
            <ModalityIcons items={outputModalities} />
          </div>
        ) : null}

        <div className='mt-4 flex-1'>{priceBlock}</div>

        {contextLength || maxOutput ? (
          <div className='mt-4 grid grid-cols-2 gap-3 border-t border-[var(--portal-hairline)] pt-3'>
            <div>
              <p className='text-lg font-semibold text-[var(--portal-ink)] tabular-nums'>
                {contextLength || '—'}
              </p>
              <p className='text-muted-foreground text-xs'>{t('Context')}</p>
            </div>
            <div className='text-end'>
              <p className='text-lg font-semibold text-[var(--portal-ink)] tabular-nums'>
                {maxOutput || '—'}
              </p>
              <p className='text-muted-foreground text-xs'>{t('Max output')}</p>
            </div>
          </div>
        ) : null}
      </div>
    </PortalBezel>
  )
})

function ModalityIcons(props: { items: Modality[] }) {
  if (props.items.length === 0) return null
  return (
    <>
      {props.items.map((item) => {
        const Icon = MODALITY_ICONS[item] ?? Type
        return <Icon key={item} className='size-3.5' aria-hidden />
      })}
    </>
  )
}

function formatCompactTokens(tokens?: number): string {
  if (!tokens || !Number.isFinite(tokens) || tokens <= 0) return ''
  if (tokens >= 1_000_000) return `${TOKEN_FORMAT.format(tokens / 1_000_000)}M`
  if (tokens >= 1_000) return `${TOKEN_FORMAT.format(tokens / 1_000)}K`
  return TOKEN_FORMAT.format(tokens)
}
