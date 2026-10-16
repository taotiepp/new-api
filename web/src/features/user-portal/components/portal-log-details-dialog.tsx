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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LOG_TYPE_ENUM, LOG_TYPES } from '@/features/usage-logs/constants'
import type { UsageLog } from '@/features/usage-logs/data/schema'
import {
  formatAppliedDiscount,
  formatDiscountMultiplier,
  getAppliedUserDiscount,
} from '@/features/usage-logs/lib/discount-display'
import {
  getTieredBillingSummary,
  parseLogOther,
} from '@/features/usage-logs/lib/format'
import {
  isPerCallBilling,
  isTimingLogType,
} from '@/features/usage-logs/lib/utils'
import type { LogOtherData } from '@/features/usage-logs/types'
import {
  formatBillingCurrencyFromUSD,
  usePricingCurrency,
} from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import { formatNumber, formatUseTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type PortalLogDetailsDialogProps = {
  log: UsageLog | null
  onOpenChange: (open: boolean) => void
}

const PRICE_OPTS = { digitsLarge: 4, digitsSmall: 6, abbreviate: false }

export function PortalLogDetailsDialog(props: PortalLogDetailsDialogProps) {
  const { t } = useTranslation()
  const { formatQuota } = usePricingCurrency()
  const log = props.log
  const other = log ? parseLogOther(log.other) : null
  const typeLabel =
    LOG_TYPES.find((item) => item.value === log?.type)?.label ?? 'Unknown'
  const showTiming = log != null && isTimingLogType(log.type)
  const tokensPerSecond =
    log != null && log.use_time > 0 && log.completion_tokens > 0
      ? log.completion_tokens / log.use_time
      : null
  const cacheRead = other?.cache_tokens || 0
  const cacheWrite = other?.cache_creation_tokens || 0
  const cacheWrite5m = other?.cache_creation_tokens_5m || 0
  const cacheWrite1h = other?.cache_creation_tokens_1h || 0
  const firstTokenSeconds =
    other?.frt != null && other.frt > 0 ? other.frt / 1000 : null

  const rows = log
    ? [
        {
          label: t('Created'),
          value: dayjs.unix(log.created_at).format('YYYY-MM-DD HH:mm:ss'),
        },
        { label: t('Type'), value: t(typeLabel) },
        { label: t('Model'), value: log.model_name || t('Unknown model') },
        { label: t('Token Name'), value: log.token_name || '—' },
        { label: t('Request ID'), value: log.request_id || '—' },
        { label: t('Input tokens'), value: formatNumber(log.prompt_tokens) },
        {
          label: t('Output tokens'),
          value: formatNumber(log.completion_tokens),
        },
      ]
    : []

  if (showTiming && cacheRead > 0) {
    rows.push({ label: t('Cache Read'), value: formatNumber(cacheRead) })
  }
  if (
    showTiming &&
    cacheWrite > 0 &&
    cacheWrite5m === 0 &&
    cacheWrite1h === 0
  ) {
    rows.push({ label: t('Cache Write'), value: formatNumber(cacheWrite) })
  }
  if (showTiming && cacheWrite5m > 0) {
    rows.push({
      label: t('Cache Write (5m)'),
      value: formatNumber(cacheWrite5m),
    })
  }
  if (showTiming && cacheWrite1h > 0) {
    rows.push({
      label: t('Cache Write (1h)'),
      value: formatNumber(cacheWrite1h),
    })
  }
  if (showTiming && log) {
    let streamLabel = log.is_stream ? t('Stream') : t('Non-stream')
    if (other?.is_task === true) {
      streamLabel = t('Async')
    }
    rows.push({ label: t('Stream'), value: streamLabel })
    rows.push({
      label: t('Throughput short'),
      value:
        tokensPerSecond != null ? `${Math.round(tokensPerSecond)} t/s` : '—',
    })
    rows.push({ label: t('Duration'), value: formatUseTime(log.use_time) })
    if (log.is_stream) {
      rows.push({
        label: t('First token'),
        value:
          firstTokenSeconds == null
            ? t('N/A')
            : formatUseTime(firstTokenSeconds),
      })
    }
  }
  if (log) {
    rows.push({ label: t('Quota'), value: formatQuota(log.quota) })
    const userDiscount = getAppliedUserDiscount(other)
    if (userDiscount) {
      rows.push({
        label: t('Customer discount'),
        value: formatAppliedDiscount(userDiscount, t),
      })
    }
  }

  const formula =
    log != null ? formatPortalCostFormula(log, other, t, formatQuota) : ''

  return (
    <Dialog open={log != null} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Request Logs')}</DialogTitle>
        </DialogHeader>
        <dl className='grid gap-3'>
          {rows.map((row) => (
            <div key={row.label} className='grid gap-1 sm:grid-cols-[8rem_1fr]'>
              <dt className='text-muted-foreground text-sm'>{row.label}</dt>
              <dd className='text-sm break-all text-[var(--portal-ink)]'>
                {row.value}
              </dd>
            </div>
          ))}
          {formula ? (
            <div className='grid gap-1'>
              <dt className='text-muted-foreground text-sm'>
                {t('Cost formula')}
              </dt>
              <dd className='rounded-[var(--portal-radius)] bg-[var(--portal-surface-muted)] px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap text-[var(--portal-ink)]'>
                {formula}
              </dd>
            </div>
          ) : null}
          {log?.content ? (
            <div className='grid gap-1'>
              <dt className='text-muted-foreground text-sm'>{t('Content')}</dt>
              <dd
                className={cn(
                  'rounded-[var(--portal-radius)] bg-[var(--portal-surface-muted)] px-3 py-2 text-sm break-all whitespace-pre-wrap',
                  log.type === LOG_TYPE_ENUM.ERROR &&
                    'text-red-600 dark:text-red-400'
                )}
              >
                {log.content}
              </dd>
            </div>
          ) : null}
        </dl>
        <DialogFooter>
          <Button
            type='button'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatPrice(usd: number): string {
  return formatBillingCurrencyFromUSD(usd, PRICE_OPTS)
}

function effectiveGroupRatio(other: LogOtherData): {
  labelKey: 'User Exclusive Ratio' | 'Group Ratio'
  value: number
} | null {
  const userGR = other.user_group_ratio
  const isUserGR = userGR != null && Number.isFinite(userGR) && userGR !== -1
  const value = isUserGR ? userGR : other.group_ratio
  if (value == null || !Number.isFinite(value)) return null
  return {
    labelKey: isUserGR ? 'User Exclusive Ratio' : 'Group Ratio',
    value,
  }
}

function formulaDiscountLabel(
  other: LogOtherData,
  t: (key: string) => string
): string {
  const userDiscount = getAppliedUserDiscount(other)
  if (userDiscount) {
    const applied = formatAppliedDiscount(userDiscount, t)
    const separator = ' · '
    const splitAt = applied.indexOf(separator)
    if (splitAt === -1) return `${t('Customer discount')} ${applied}`
    const multiplier = applied.slice(0, splitAt)
    const source = applied.slice(splitAt + separator.length)
    return `${t('Customer discount')} ${multiplier} (${source})`
  }
  const group = effectiveGroupRatio(other)
  if (!group) return ''
  return `${t(group.labelKey)} ${formatDiscountMultiplier(group.value)}`
}

function tieredTermTokens(
  field: string,
  log: UsageLog,
  other: LogOtherData,
  fields: ReadonlySet<string>
): number {
  const cacheRead = other.cache_tokens || 0
  const cacheWrite5m = other.cache_creation_tokens_5m || 0
  const cacheWrite1h = other.cache_creation_tokens_1h || 0
  const cacheWrite = other.cache_creation_tokens || 0
  const imageTokens = other.image_output || 0
  const audioIn = other.audio_input_token_count || other.audio_input || 0
  const audioOut = other.audio_output || 0
  const showOneHour = fields.has('cacheCreate1hPrice') && cacheWrite1h > 0
  let writeTokens = cacheWrite
  if (cacheWrite5m > 0) {
    writeTokens = cacheWrite5m
  } else if (showOneHour && cacheWrite >= cacheWrite1h) {
    writeTokens = cacheWrite - cacheWrite1h
  }

  if (field === 'cacheReadPrice') return cacheRead
  if (field === 'cacheCreatePrice') return writeTokens
  if (field === 'cacheCreate1hPrice') return cacheWrite1h
  if (field === 'imagePrice') return imageTokens
  if (field === 'audioInputPrice') return audioIn
  if (field === 'audioOutputPrice') return audioOut

  if (other.claude === true) {
    if (field === 'inputPrice') return Math.max(log.prompt_tokens, 0)
    if (field === 'outputPrice') return Math.max(log.completion_tokens, 0)
    return 0
  }

  if (field === 'outputPrice') {
    const tokens = fields.has('audioOutputPrice')
      ? log.completion_tokens - audioOut
      : log.completion_tokens
    return Math.max(tokens, 0)
  }
  if (field === 'inputPrice') {
    let tokens = log.prompt_tokens
    if (fields.has('cacheReadPrice')) tokens -= cacheRead
    if (fields.has('cacheCreatePrice')) tokens -= writeTokens
    if (showOneHour) tokens -= cacheWrite1h
    if (fields.has('imagePrice')) tokens -= imageTokens
    if (fields.has('audioInputPrice')) tokens -= audioIn
    return Math.max(tokens, 0)
  }
  return 0
}

function tokenPriceTerm(
  label: string,
  tokens: number,
  priceLabel: string
): string | null {
  if (tokens <= 0) return null
  return `${label} ${formatNumber(tokens)} × ${priceLabel}`
}

function surchargeTerms(
  other: LogOtherData,
  t: (key: string) => string
): string[] {
  const terms: string[] = []
  if (other.web_search && other.web_search_call_count) {
    const price = other.web_search_price
      ? ` × ${formatPrice(other.web_search_price)}`
      : ''
    terms.push(
      `${t('Web Search')} ${formatNumber(other.web_search_call_count)}${price}`
    )
  }
  if (other.file_search && other.file_search_call_count) {
    const price = other.file_search_price
      ? ` × ${formatPrice(other.file_search_price)}`
      : ''
    terms.push(
      `${t('File Search')} ${formatNumber(other.file_search_call_count)}${price}`
    )
  }
  if (other.image_generation_call && other.image_generation_call_price) {
    terms.push(
      `${t('Image Generation')} ${formatPrice(other.image_generation_call_price)}`
    )
  }
  return terms
}

function perTokenFormulaTerms(
  log: UsageLog,
  other: LogOtherData,
  t: (key: string) => string
): string[] {
  if (other.model_ratio == null) return []
  const inputPrice = other.model_ratio * 2.0
  const cacheRead = other.cache_tokens || 0
  const cacheWrite = other.cache_creation_tokens || 0
  const cacheWrite5m = other.cache_creation_tokens_5m || 0
  const cacheWrite1h = other.cache_creation_tokens_1h || 0
  const showPlainWrite =
    cacheWrite > 0 && cacheWrite5m === 0 && cacheWrite1h === 0
  let inputTokens = log.prompt_tokens
  if (other.claude !== true) {
    inputTokens -= cacheRead
    if (showPlainWrite) inputTokens -= cacheWrite
    if (cacheWrite5m > 0) inputTokens -= cacheWrite5m
    if (cacheWrite1h > 0) inputTokens -= cacheWrite1h
    inputTokens = Math.max(inputTokens, 0)
  }

  const terms: string[] = []
  const inputTerm = tokenPriceTerm(
    t('Input'),
    inputTokens,
    `${formatPrice(inputPrice)}/M`
  )
  if (inputTerm) terms.push(inputTerm)
  if (other.completion_ratio != null) {
    const outputTerm = tokenPriceTerm(
      t('Output'),
      log.completion_tokens,
      `${formatPrice(inputPrice * other.completion_ratio)}/M`
    )
    if (outputTerm) terms.push(outputTerm)
  }
  if (cacheRead > 0) {
    const cacheRatio = other.cache_ratio ?? 1
    const term = tokenPriceTerm(
      t('Cache Read'),
      cacheRead,
      `${formatPrice(inputPrice * cacheRatio)}/M`
    )
    if (term) terms.push(term)
  }
  if (showPlainWrite) {
    const writeRatio = other.cache_creation_ratio ?? 1
    const term = tokenPriceTerm(
      t('Cache Write'),
      cacheWrite,
      `${formatPrice(inputPrice * writeRatio)}/M`
    )
    if (term) terms.push(term)
  }
  if (cacheWrite5m > 0) {
    const writeRatio = other.cache_creation_ratio_5m ?? 1
    const term = tokenPriceTerm(
      t('Cache Write (5m)'),
      cacheWrite5m,
      `${formatPrice(inputPrice * writeRatio)}/M`
    )
    if (term) terms.push(term)
  }
  if (cacheWrite1h > 0) {
    const writeRatio = other.cache_creation_ratio_1h ?? 1
    const term = tokenPriceTerm(
      t('Cache Write (1h)'),
      cacheWrite1h,
      `${formatPrice(inputPrice * writeRatio)}/M`
    )
    if (term) terms.push(term)
  }
  return terms
}

function formatPortalCostFormula(
  log: UsageLog,
  other: LogOtherData | null,
  t: (key: string) => string,
  formatQuota: (quota: number) => string
): string {
  const total = formatQuota(log.quota)
  if (!other) return `${t('Total Cost')} = ${total}`

  const discount = formulaDiscountLabel(other, t)
  const terms: string[] = []
  let tierPrefix = ''

  if (other.billing_mode === 'tiered_expr') {
    if (other.matched_tier) {
      tierPrefix = `${t('Matched Tier')}: ${other.matched_tier}\n`
    }
    const summary = getTieredBillingSummary(other)
    if (summary) {
      const fields = new Set(summary.priceEntries.map((entry) => entry.field))
      for (const entry of summary.priceEntries) {
        const unit = entry.unit === 'request' ? t('request') : 'M'
        const priceLabel = `${formatPrice(entry.price)}/${unit}`
        if (entry.unit === 'request') {
          terms.push(`${t(entry.shortLabel)} ${priceLabel}`)
          continue
        }
        const term = tokenPriceTerm(
          t(entry.shortLabel),
          tieredTermTokens(entry.field, log, other, fields),
          priceLabel
        )
        if (term) terms.push(term)
      }
    }
  } else if (isPerCallBilling(other.model_price)) {
    if (other.model_price != null) {
      terms.push(`${t('Per-call')} ${formatPrice(other.model_price)}`)
    }
  } else {
    terms.push(...perTokenFormulaTerms(log, other, t))
  }

  terms.push(...surchargeTerms(other, t))

  if (terms.length === 0) {
    if (!discount) return `${t('Total Cost')} = ${total}`
    return `${tierPrefix}× ${discount} = ${total}`
  }

  const sum = terms.length === 1 ? terms[0] : `(${terms.join(' + ')})`
  const equation = discount ? `(${terms.join(' + ')}) × ${discount}` : sum
  return `${tierPrefix}${equation} = ${total}`
}
