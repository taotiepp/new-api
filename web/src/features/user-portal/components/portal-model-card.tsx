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
  AudioLines,
  File,
  Image as ImageIcon,
  Type,
  Video,
} from 'lucide-react'
import { memo, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
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

  const meta = [vendorLabel, ...tags].filter(Boolean).join(', ')
  const limits = [
    contextLength ? `${t('Context')} ${contextLength}` : '',
    maxOutput ? `${t('Max output')} ${maxOutput}` : '',
  ].filter(Boolean)

  return (
    <article className='border-b border-[var(--portal-hairline)] py-4'>
      <div
        role='button'
        tabIndex={0}
        className='flex cursor-pointer flex-col gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)] sm:flex-row sm:items-start sm:justify-between'
        onClick={props.onClick}
        onKeyDown={handleKeyDown}
      >
        <div className='min-w-0 flex-1'>
          <div className='flex items-start gap-3'>
            <div
              aria-hidden
              className='mt-0.5 flex size-8 shrink-0 items-center justify-center'
            >
              {modelIcon || (
                <span className='text-sm font-medium text-[var(--portal-ink)]'>
                  {initial}
                </span>
              )}
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                <h3
                  className='text-[1.05rem] leading-snug font-medium [overflow-wrap:anywhere] text-[var(--portal-ink)]'
                  title={props.model.model_name}
                >
                  {props.model.model_name}
                </h3>
                <div
                  className='flex items-center gap-1'
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <CopyButton
                    value={props.model.model_name}
                    tooltip={t('Copy model name')}
                    className='size-6'
                    iconClassName='size-3'
                  />
                  <Button
                    size='sm'
                    variant='ghost'
                    className='h-7 px-2 text-[var(--portal-ink-muted)]'
                    render={
                      <Link
                        to='/app/playground'
                        search={{ model: props.model.model_name }}
                      />
                    }
                  >
                    {t('Try Online')}
                  </Button>
                </div>
              </div>
              {meta ? (
                <p className='mt-0.5 text-sm text-[var(--portal-ink-muted)]'>
                  {meta}
                </p>
              ) : null}
              {summary ? (
                <p className='mt-1 line-clamp-2 max-w-2xl text-sm leading-relaxed text-[var(--portal-ink-muted)]'>
                  {summary}
                </p>
              ) : null}
              {inputModalities.length > 0 || outputModalities.length > 0 ? (
                <div className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--portal-ink-muted)]'>
                  {inputModalities.length > 0 ? (
                    <span className='inline-flex items-center gap-1.5'>
                      {t('Input')}
                      <ModalityIcons items={inputModalities} />
                    </span>
                  ) : null}
                  {outputModalities.length > 0 ? (
                    <span className='inline-flex items-center gap-1.5'>
                      {t('Output')}
                      <ModalityIcons items={outputModalities} />
                    </span>
                  ) : null}
                </div>
              ) : null}
              {limits.length > 0 ? (
                <p className='mt-1 text-sm text-[var(--portal-ink-muted)]'>
                  {limits.join('. ')}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className='sm:max-w-xs sm:shrink-0 sm:text-end [&_p:first-of-type]:text-base [&_p:first-of-type]:font-medium [&_p:first-of-type]:text-[var(--portal-ink)]'>
          {priceBlock}
        </div>
      </div>
    </article>
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
